"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import { disclaimer } from "@/lib/mock/data";
import { label } from "@/components/workspace/format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* Presentational primitives: chips, cards, empty states, dialogs, URL-bound filters. */
export function Chip({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"chip " + tone}>{children}</span>;
}
export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="card-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Foot() {
  return (
    <p className="disclaimer">
      {disclaimer} <span>Sample data shown.</span>
    </p>
  );
}
export function Empty({
  text = "No results match these filters.",
  onClear,
}: {
  text?: string;
  onClear?: () => void;
}) {
  return (
    <div className="empty">
      <Icon name="search" size={30} />
      <h3>{text}</h3>
      {onClear && <button onClick={onClear}>Clear filters</button>}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  drawer = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : ""}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Filter({
  name,
  options,
  title,
}: {
  name: string;
  options: string[];
  title: string;
}) {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  return (
    <select
      aria-label={title}
      value={params.get(name) || ""}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
          scroll: false,
        });
      }}
    >
      <option value="">{title}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}
export function Search({ placeholder }: { placeholder: string }) {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const query = params.get("q") || "";
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setValue(query);
  }, [query]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="search-field">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const text = e.target.value;
          timer.current = setTimeout(() => {
            const next = new URLSearchParams(params);
            if (text) next.set("q", text);
            else next.delete("q");
            router.replace(
              pathname + (next.size ? "?" + next.toString() : ""),
              { scroll: false },
            );
          }, 180);
        }}
      />
    </div>
  );
}
