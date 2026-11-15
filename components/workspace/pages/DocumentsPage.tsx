"use client";
import Icon from "@/components/Icon";
import { Card, Filter, Search } from "@/components/workspace/ui";
import { Header, DocumentTable } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { filesFromDrop } from "@/lib/api/upload-batch";

/** Global documents table. */
export default function DocumentsPage() {
  const { params, data, setDroppedFiles, query, q, open } = useWorkspace();
  const items = data.documents.filter(
    (d) =>
      d.name.toLowerCase().includes(q.toLowerCase()) &&
      (!params.get("matterId") || d.matterId === params.get("matterId")) &&
      (!params.get("type") || d.type === params.get("type")),
  );
  return (
    <>
      <Header
        title="Documents"
        subtitle="All legal documents across your matters."
        action={
          <button className="primary" onClick={() => open("upload")}>
            <Icon name="upload" />
            Upload documents
          </button>
        }
      />
      <div className="filters">
        <Search placeholder="Search documents…" />
        <select
          aria-label="Filter by matter"
          value={params.get("matterId") || ""}
          onChange={(e) => query("matterId", e.target.value)}
        >
          <option value="">All matters</option>
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Filter
          name="type"
          title="All types"
          options={[...new Set(data.documents.map((d) => d.type))]}
        />
      </div>
      <Card className="page-body">
        <DocumentTable items={items} />
      </Card>
      <button
        className="dropzone"
        onClick={() => open("upload")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          // Read the files (and any folders) first, then open the
          // upload window with them already listed.
          filesFromDrop(e.dataTransfer).then((files) => {
            open("upload");
            setDroppedFiles(files);
          });
        }}
      >
        <Icon name="upload" />
        <span>
          Drop documents or a whole folder here, or click to choose{" "}
          <small>
            PDF or Word (.docx) · Up to 20 MB each · As many as you like
          </small>
        </span>
      </button>
    </>
  );
}
