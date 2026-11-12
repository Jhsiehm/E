"use client";
import { disclaimer } from "@/lib/mock/data";
import { download } from "@/components/workspace/format";
import { useWorkspace } from "@/components/workspace/context";

/** Archive, export and other matter actions. */
export default function MatterActionsModal() {
  const { router, setModal, notify, matter, mutate } = useWorkspace();
  if (!matter) return null;
  return (
    <div className="menu-actions">
      <button
        onClick={async () => {
          if (
            await mutate(
              "matters/" + matter.id,
              {
                status: matter.status === "archived" ? "active" : "archived",
              },
              "PATCH",
            )
          ) {
            setModal("");
            notify("Matter status updated.");
          }
        }}
      >
        {matter.status === "archived" ? "Restore" : "Archive"} matter
      </button>
      <button
        onClick={async () => {
          const result = await mutate("matters", {
            ...matter,
            name: matter.name + " (copy)",
          });
          if (result) {
            setModal("");
            router.push("/matters/" + result.id);
          }
        }}
      >
        Duplicate matter
      </button>
      <button
        onClick={() => {
          download(
            "matter-summary.txt",
            `${matter.name}\n${matter.docket} | ${matter.court}\n\n${matter.summary}\n\n${disclaimer}`,
          );
          setModal("");
        }}
      >
        Export summary
      </button>
    </div>
  );
}
