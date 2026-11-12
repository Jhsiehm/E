"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";
import { nav } from "./workspace/format";
import { Modal } from "./workspace/ui";
import { WorkspaceContext } from "./workspace/context";
import {
  useWorkspaceController,
  type LoadedWorkspace,
} from "./workspace/useWorkspaceController";
import DashboardPage from "./workspace/pages/DashboardPage";
import MattersPage from "./workspace/pages/MattersPage";
import MatterPage from "./workspace/matter/MatterPage";
import NoticesPage from "./workspace/pages/NoticesPage";
import AgentsPage from "./workspace/pages/AgentsPage";
import PrecedentsPage from "./workspace/pages/PrecedentsPage";
import DocumentsPage from "./workspace/pages/DocumentsPage";
import CalendarPage from "./workspace/pages/CalendarPage";
import SettingsPage from "./workspace/pages/SettingsPage";
import NotFoundPage from "./workspace/pages/NotFoundPage";
import NewMatterModal from "./workspace/modals/NewMatterModal";
import UploadModal from "./workspace/modals/UploadModal";
import EventModal from "./workspace/modals/EventModal";
import EventDetailModal from "./workspace/modals/EventDetailModal";
import NoticeModal from "./workspace/modals/NoticeModal";
import PrecedentModal from "./workspace/modals/PrecedentModal";
import AgentModal from "./workspace/modals/AgentModal";
import ShareModal from "./workspace/modals/ShareModal";
import MatterActionsModal from "./workspace/modals/MatterActionsModal";
import DocumentModal from "./workspace/modals/DocumentModal";
import MotionModal from "./workspace/modals/MotionModal";
import SearchModal from "./workspace/modals/SearchModal";

/** Route table: first path segment (and matter presence) -> screen. */
function routeContent(ws: LoadedWorkspace): ReactNode {
  const { page, parts, matter } = ws;
  if (page === "dashboard") return <DashboardPage />;
  if (page === "matters" && !parts[1]) return <MattersPage />;
  if (page === "matters" && matter) return <MatterPage />;
  if (page === "notices") return <NoticesPage />;
  if (page === "agents") return <AgentsPage />;
  if (page === "precedents") return <PrecedentsPage />;
  if (page === "documents") return <DocumentsPage />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "settings") return <SettingsPage />;
  return <NotFoundPage />;
}

/** App shell: loads workspace state, then renders sidebar, route and dialogs. */
export default function Workspace() {
  const ws = useWorkspaceController();
  const { data, error, refresh } = ws;
  if (!data)
    return (
      <div className="boot">
        <div className="logo-grid">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <h1>Casevex</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={refresh}>Try again</button>
          </>
        ) : (
          <>
            <p>Opening your workspace</p>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        )}
      </div>
    );
  const loaded = { ...ws, data } as LoadedWorkspace;
  const { page, matter, unread, hasImpact, toast, setToast, modal, setModal } =
    loaded;
  const content = routeContent(loaded);
  return (
    <WorkspaceContext.Provider value={loaded}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="logo-grid">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            Casevex
          </Link>
          <nav className="main-nav" aria-label="Primary">
            {nav.map(([href, title, icon]) => (
              <Link
                key={title}
                href={"/" + href}
                className={
                  (
                    href === ""
                      ? page === "dashboard"
                      : page === href.split("/")[0]
                  )
                    ? "active"
                    : ""
                }
                aria-current={
                  (
                    href === ""
                      ? page === "dashboard"
                      : page === href.split("/")[0]
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon name={icon} />
                {title}
                {title === "Notices" && unread > 0 && (
                  <span className="nav-count">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-matters">
            <p className="eyebrow">Active matters</p>
            <div className="scroll">
              {data.matters.map((m) => (
                <Link
                  key={m.id}
                  href={"/matters/" + m.id}
                  className={matter?.id === m.id ? "selected" : ""}
                >
                  <Icon name="matters" size={15} />
                  <span>{m.name}</span>
                  {hasImpact(m.id) && <i className="impact-dot" />}
                </Link>
              ))}
            </div>
          </div>
          <Link className="user-block" href="/settings/profile">
            <span className="avatar">
              {data.me.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="grow">
              {data.me.name}
              <small>{data.me.role}</small>
            </span>
            <span>⌄</span>
          </Link>
        </aside>
        <main id="main" tabIndex={-1}>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {content}
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              className="icon-button flat"
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {modal && (
          <Modal
            title={
              (
                {
                  matter: "New matter",
                  upload: "Upload document",
                  event: "Add event",
                  notice: "Notice details",
                  document: "Document details",
                  precedent: "Add precedent",
                  agent: "Assign agent",
                  share: "Share matter",
                  "matter-actions": "Matter actions",
                  search: "Search your authority library",
                  "event-detail": "Event details",
                  motion: "Research motion",
                } as Record<string, string>
              )[modal] || modal
            }
            onClose={() => setModal("")}
            drawer={modal === "notice"}
          >
            {modal === "matter" && <NewMatterModal />}
            {modal === "upload" && <UploadModal />}
            {modal === "event" && <EventModal />}
            {modal === "event-detail" && <EventDetailModal />}
            {modal === "notice" && <NoticeModal />}
            {modal === "precedent" && <PrecedentModal />}
            {modal === "agent" && <AgentModal />}
            {modal === "share" && <ShareModal />}
            {modal === "matter-actions" && <MatterActionsModal />}
            {modal === "document" && <DocumentModal />}
            {modal === "motion" && <MotionModal />}
            {modal === "search" && <SearchModal />}
          </Modal>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
