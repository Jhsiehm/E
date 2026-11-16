"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, ApiError, type Method } from "@/lib/api/client";
import type { State, Message, Notice } from "@/lib/mock/data";
import { appendChat, nonEmpty } from "@/components/workspace/chat-state";

/** Prototype mutation responses: the created/updated record (or a list). */
type MutationResult = { id: string } & Record<string, unknown>;

/**
 * All client state and actions for the workspace UI. Moved verbatim from the
 * former single-file Workspace component; screens read it via useWorkspace().
 * Data still comes from the prototype's full-state bootstrap; P1+ replaces
 * this with scoped hooks on lib/api/client.ts.
 */
export function useWorkspaceController(defaultPractice = "Civil litigation") {
  const pathname = usePathname(),
    router = useRouter(),
    params = useSearchParams();
  const parts = pathname.split("/").filter(Boolean);
  const page = parts[0] || "dashboard",
    sub = parts[2] || "overview";
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [droppedFiles, setDroppedFiles] = useState<File[]>([]),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [question, setQuestion] = useState(""),
    [practice, setPractice] = useState(defaultPractice),
    [editing, setEditing] = useState(false),
    [summary, setSummary] = useState(""),
    [chatText, setChatText] = useState(""),
    [stream, setStream] = useState<Message | null>(null),
    [reading, setReading] = useState(false),
    [month, setMonth] = useState("2026-11"),
    [profile, setProfile] = useState<State["me"] | null>(null),
    [strategy, setStrategy] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null),
    sending = useRef(false),
    alive = useRef(true),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    routeRef = useRef(pathname);
  routeRef.current = pathname;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const d = await api.get<State>("bootstrap");
      // Live mode does not store conversations yet: keep this visit's chats
      // for any matter the server sends none for.
      setData((prev) =>
        prev && d.live
          ? { ...d, chats: { ...prev.chats, ...nonEmpty(d.chats) } }
          : d,
      );
      setError("");
      return d;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "workspace_required") {
          router.replace("/onboarding?workspace=1");
          return;
        }
        if (error.status === 401) {
          router.replace("/sign-in");
          return;
        }
        setError(error.message);
      } else setError("We could not load this. Try again.");
    }
  }, [router]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  // A window asked to open on the next page (see openAfter) survives the
  // page change; every other window closes when the page changes.
  const afterRoute = useRef<{ name: string; id: string } | null>(null);
  useEffect(() => {
    const next = afterRoute.current;
    afterRoute.current = null;
    if (next) setSelected(next.id);
    setModal(next?.name ?? "");
    setEditing(false);
    setStream(null);
  }, [pathname]);
  useEffect(() => {
    if (data && !profile) setProfile(data.me);
  }, [data, profile]);
  const matter = data?.matters.find((m) => m.id === parts[1]);
  useEffect(() => {
    setStrategy(data?.strategies[parts[1]] || "");
  }, [parts[1], data?.strategies]);
  useEffect(() => {
    const thread = chatEnd.current?.parentElement;
    thread?.scrollTo({
      top: thread.scrollHeight,
      behavior: reading ? "instant" : "smooth",
    });
  }, [stream, reading, data?.chats]);
  const mutate = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    try {
      const result = await api.request<MutationResult>(method as Method, path, {
        body,
      });
      await refresh();
      return result;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const query = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
      scroll: false,
    });
  };
  const clear = () => router.replace(pathname, { scroll: false });
  const q = params.get("q") || "";
  const open = (name: string, id = "") => {
    if (name.startsWith("upload")) setDroppedFiles([]);
    setSelected(id);
    setModal(name);
  };
  /** Go to a page and open a window there once it has loaded. */
  const openAfter = (path: string, name: string, id = "") => {
    if (path === pathname) return open(name, id);
    if (name.startsWith("upload")) setDroppedFiles([]);
    afterRoute.current = { name, id };
    router.push(path);
  };
  const submit = async (
    e: FormEvent<HTMLFormElement>,
    path: string,
    method = "POST",
  ) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const r = await mutate(path, body, method);
    if (r) setModal("");
    return r;
  };
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending.current || !matter) return;
      sending.current = true;
      setChatText("");
      setReading(true);
      const location = pathname;
      const user: Message = { id: crypto.randomUUID(), role: "user", text };
      setData((d) => appendChat(d, matter.id, user));
      try {
        const answer = await api.post<Message>(`matters/${matter.id}/chat`, {
          text,
        });
        // The simulated demo answer pauses as if reading; real research
        // already took its time.
        if (!answer.mode)
          await new Promise((r) =>
            setTimeout(
              r,
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : 1700,
            ),
          );
        setReading(false);
        const stride = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? answer.text.length + 18
          : 18;
        for (let i = 0; i <= answer.text.length + stride; i += stride) {
          if (!alive.current || routeRef.current !== location) break;
          setStream({ ...answer, text: answer.text.slice(0, i) });
          await new Promise((r) => setTimeout(r, 32));
        }
        setData((d) => appendChat(d, matter.id, answer));
        await refresh();
        setStream(null);
      } catch (error) {
        notify(
          error instanceof ApiError && error.status !== 500
            ? error.message
            : "Message could not be sent. Please retry.",
        );
        await refresh();
      } finally {
        setReading(false);
        sending.current = false;
      }
    },
    [matter, pathname, refresh, notify],
  );
  const prefilled = useRef("");
  useEffect(() => {
    const question = params.get("question");
    if (
      data &&
      matter &&
      sub === "chat" &&
      question &&
      prefilled.current !== question
    ) {
      prefilled.current = question;
      void send(question);
    }
  }, [data, matter, sub, params, send]);
  const unread = data ? data.notices.filter((n) => !n.read).length : 0;
  const nameOf = (id: string) =>
    data?.matters.find((m) => m.id === id)?.name || "Matter";
  const hasImpact = (id: string) =>
    !!data?.notices.some(
      (n) => !n.read && n.kind === "ruling" && n.matterIds.includes(id),
    );

  async function openNotice(n: Notice) {
    setSelected(n.id);
    setModal("notice");
    if (!n.read) await mutate("notices/read", { ids: [n.id] });
  }

  return {
    pathname,
    router,
    params,
    parts,
    page,
    sub,
    data,
    setData,
    error,
    setError,
    toast,
    setToast,
    modal,
    setModal,
    droppedFiles,
    setDroppedFiles,
    openAfter,
    selected,
    setSelected,
    busy,
    setBusy,
    question,
    setQuestion,
    practice,
    setPractice,
    editing,
    setEditing,
    summary,
    setSummary,
    chatText,
    setChatText,
    stream,
    setStream,
    reading,
    setReading,
    month,
    setMonth,
    profile,
    setProfile,
    strategy,
    setStrategy,
    chatEnd,
    notify,
    refresh,
    matter,
    mutate,
    query,
    clear,
    q,
    open,
    submit,
    send,
    unread,
    nameOf,
    hasImpact,
    openNotice,
  };
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
/** Controller once the initial load has succeeded. */
export type LoadedWorkspace = WorkspaceController & { data: State };
