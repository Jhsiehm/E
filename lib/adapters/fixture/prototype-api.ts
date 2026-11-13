import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/mock/store";
import { DATA_MODE_HEADER } from "@/lib/runtime/data-mode";
import {
  sampleAnswer,
  sources,
  type Matter,
  type Doc,
  type Message,
} from "@/lib/mock/data";
/**
 * FIXTURE ADAPTER: in-memory, cookie-keyed prototype API with synthetic sample
 * data. Never used unless resolveDataMode() returns "fixture"; every response
 * carries `X-Casevex-Data-Mode: fixture`. Moved unchanged from the former
 * app/api/[...path]/route.ts.
 */
export async function handleFixture(req: NextRequest, path: string[]) {
  const id = req.cookies.get("casevex-demo")?.value || crypto.randomUUID();
  const s = getState(id);
  await new Promise((r) => setTimeout(r, 300));
  const reply = (data: unknown, status = 200) => {
    const res = NextResponse.json(data, { status });
    res.headers.set(DATA_MODE_HEADER, "fixture");
    res.cookies.set("casevex-demo", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
      secure: req.nextUrl.protocol === "https:",
    });
    return res;
  };
  try {
    const q = req.nextUrl.searchParams;
    const method = req.method;
    const body =
      method === "GET" || method === "DELETE"
        ? {}
        : req.headers.get("content-type")?.includes("application/json")
          ? await req.json()
          : {};
    if (path[0] === "bootstrap") return reply(s);
    if (path[0] === "me") {
      if (method === "PATCH") {
        for (const key of [
          "name",
          "email",
          "role",
          "theme",
          "defaultPracticeArea",
          "timeZone",
        ] as const)
          if (typeof body[key] === "string") s.me[key] = body[key];
      }
      return reply(s.me);
    }
    if (path[0] === "reset" && method === "POST") {
      const { seed } = await import("@/lib/mock/data");
      Object.assign(s, seed());
      return reply(s);
    }
    if (path[0] === "matters") {
      if (path[1]) {
        const m = s.matters.find((m) => m.id === path[1]);
        if (!m) return reply({ error: "Matter not found" }, 404);
        if (path[2] === "chat") {
          s.chats[m.id] ??= [];
          if (method === "POST") {
            if (!body.text?.trim())
              return reply({ error: "A message is required" }, 400);
            s.chats[m.id].push({
              id: crypto.randomUUID(),
              role: "user",
              text: body.text,
            });
            const answer: Message = {
              id: crypto.randomUUID(),
              role: "agent",
              text:
                m.id === "anderson"
                  ? sampleAnswer
                  : `This is a simulated research response for ${m.name}. No live legal research was performed.\n\nStart by reviewing the matter summary and available documents. Identify the issue, relevant jurisdiction, and supporting authority before drafting.\n\nRecommended next step\nAsk the assigned attorney to confirm the relevant facts and add primary authorities to this matter.`,
              sources: m.id === "anderson" ? sources : [],
            };
            s.chats[m.id].push(answer);
            return reply(answer);
          }
          return reply(s.chats[m.id]);
        }
        if (path[2] === "strategy") {
          if (method === "PATCH") s.strategies[m.id] = String(body.text || "");
          return reply({ text: s.strategies[m.id] || "" });
        }
        if (method === "PATCH") {
          for (const key of [
            "name",
            "summary",
            "status",
            "assignedAgentId",
          ] as const)
            if (typeof body[key] === "string") m[key] = body[key];
        }
        return reply({
          ...m,
          deadlines: s.deadlines.filter((d) => d.matterId === m.id),
          documents: s.documents.filter((d) => d.matterId === m.id),
        });
      }
      if (method === "POST") {
        if (!body.name?.trim())
          return reply({ error: "Matter name is required" }, 400);
        const m: Matter = {
          id: crypto.randomUUID(),
          name: body.name,
          docket: body.docket || "",
          court: body.court || "Not specified",
          type: body.type || "Civil litigation",
          status: "active",
          role: body.role || "Plaintiff",
          summary: body.summary || "Add a summary to begin research.",
          assignedAgentId: body.assignedAgentId || "civil",
          documentCount: 0,
          updatedAt: "2026-11-11",
        };
        s.matters.unshift(m);
        return reply(m, 201);
      }
      return reply(
        s.matters.filter(
          (m) =>
            (!q.get("q") ||
              `${m.name} ${m.docket}`
                .toLowerCase()
                .includes(q.get("q")!.toLowerCase())) &&
            (!q.get("status") || m.status === q.get("status")) &&
            (!q.get("type") || m.type === q.get("type")),
        ),
      );
    }
    if (path[0] === "notices") {
      if (method === "POST") {
        s.notices.forEach((n) => {
          if (body.all || body.ids?.includes(n.id)) n.read = true;
        });
      }
      return reply(
        s.notices.filter(
          (n) =>
            (!q.get("kind") || n.kind === q.get("kind")) &&
            (!q.get("unread") || !n.read),
        ),
      );
    }
    if (path[0] === "documents") {
      // The demo stores no files: the upload helper falls back to a form post.
      if (path[1] === "uploads") return reply({ mode: "form" });
      const doc = s.documents.find((d) => d.id === path[1]);
      if (path[1] && !doc) return reply({ error: "Document not found" }, 404);
      if (method === "DELETE") {
        s.documents = s.documents.filter((d) => d.id !== path[1]);
        return reply({ ok: true });
      }
      if (method === "PATCH" && doc) {
        for (const key of ["name", "matterId", "status"] as const)
          if (typeof body[key] === "string") doc[key] = body[key];
        return reply(doc);
      }
      if (method === "POST") {
        const form = await req.formData();
        const f = form.get("file");
        if (!(f instanceof File)) return reply({ error: "Select a file" }, 400);
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "docx"].includes(ext || ""))
          return reply({ error: "Choose a PDF or DOCX file" }, 400);
        if (f.size > 20000000)
          return reply({ error: "Maximum file size is 20 MB" }, 400);
        const matterId = String(form.get("matterId") || "anderson");
        if (!s.matters.some((m) => m.id === matterId))
          return reply({ error: "Choose a valid matter" }, 400);
        const d: Doc = {
          id: crypto.randomUUID(),
          matterId,
          name: f.name.replace(/\.[^.]+$/, ""),
          ext: ext!,
          sizeBytes: f.size,
          type: "Uploaded document",
          ownerInitials: "JW",
          modifiedAt: new Date().toISOString(),
          status: "draft",
        };
        s.documents.unshift(d);
        return reply(d, 201);
      }
      return reply(
        s.documents.filter(
          (d) =>
            (!q.get("matterId") || d.matterId === q.get("matterId")) &&
            (!q.get("q") ||
              d.name.toLowerCase().includes(q.get("q")!.toLowerCase())) &&
            (!q.get("type") || d.type === q.get("type")),
        ),
      );
    }
    if (path[0] === "deadlines") {
      if (method === "POST") {
        if (
          !body.title?.trim() ||
          !/^\d{4}-\d{2}-\d{2}$/.test(body.dueAt) ||
          !s.matters.some((m) => m.id === body.matterId)
        )
          return reply(
            { error: "Title, valid date, and matter are required" },
            400,
          );
        s.deadlines.push({
          id: crypto.randomUUID(),
          title: body.title,
          dueAt: body.dueAt,
          matterId: body.matterId,
          kind: body.kind || "deadline",
        });
      }
      return reply(
        s.deadlines
          .filter(
            (d) =>
              (!q.get("matterId") || d.matterId === q.get("matterId")) &&
              (!q.get("from") || d.dueAt >= q.get("from")!) &&
              (!q.get("to") || d.dueAt <= q.get("to")!),
          )
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
      );
    }
    if (path[0] === "agents") {
      if (method === "PATCH") {
        const a = s.agents.find((a) => a.id === path[1]);
        if (!a) return reply({ error: "Agent not found" }, 404);
        if (a.availability === "coming_later")
          return reply({ error: "This agent is not available yet" }, 409);
        for (const m of s.matters) {
          if (body.matterIds?.includes(m.id) && m.assignedAgentId !== a.id) {
            const old = s.agents.find((x) => x.id === m.assignedAgentId);
            if (old) old.matterCount--;
            m.assignedAgentId = a.id;
            a.matterCount++;
          }
        }
      }
      return reply(
        s.agents.filter(
          (a) =>
            (!q.get("q") ||
              a.name.toLowerCase().includes(q.get("q")!.toLowerCase())) &&
            (!q.get("area") || a.practiceArea === q.get("area")) &&
            (!q.get("availability") ||
              a.availability === q.get("availability")),
        ),
      );
    }
    if (path[0] === "precedents") {
      if (method === "POST") {
        if (!body.citation?.trim())
          return reply({ error: "Citation is required" }, 400);
        s.precedents.push({
          id: crypto.randomUUID(),
          caseName: body.caseName || "Authority awaiting review",
          citation: body.citation,
          court: body.court || "Not specified",
          decidedAt: "",
          topics: ["Pending review"],
          holding:
            "Added to the prototype for review. Citation has not been verified.",
          verified: false,
        });
      }
      return reply(
        s.precedents.filter(
          (p) =>
            (!q.get("q") ||
              `${p.caseName} ${p.citation} ${p.topics.join(" ")}`
                .toLowerCase()
                .includes(q.get("q")!.toLowerCase())) &&
            (!q.get("court") || p.court === q.get("court")) &&
            (!q.get("topic") || p.topics.includes(q.get("topic")!)),
        ),
      );
    }
    return reply({ error: "Not found" }, 404);
  } catch {
    return reply({ error: "The request could not be processed." }, 400);
  }
}
