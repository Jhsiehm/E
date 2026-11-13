/**
 * The guided tour: a few short stops, each on the screen it describes,
 * using the made-up sample matter "Anderson v. Meridian Tech".
 * Written for lawyers who have not used AI tools before: plain words,
 * one idea per stop, and a reminder to check every source.
 */
export interface TourStep {
  /** Screen the step opens. */
  path: string;
  title: string;
  body: string;
  /** Part of the screen to outline, if any. */
  target?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    path: "/",
    title: "Welcome to Casevex",
    body: "This short tour uses made-up sample cases, so nothing you do here touches a real client. It takes about two minutes, and you can stop at any time.",
    target: ".main-nav",
  },
  {
    path: "/matters",
    title: "Matters",
    body: "A matter is one case or client file. Everything for that case lives inside it: its documents, research, deadlines and notes. Only people you share a matter with can see it.",
    target: ".table-wrap",
  },
  {
    path: "/matters/anderson/documents",
    title: "Documents",
    body: "Add the complaint, contracts and letters for a matter here. Casevex reads them so you can search them and ask questions about them. Files stay private to your firm.",
    target: "main .page-body",
  },
  {
    path: "/matters/anderson/chat",
    title: "Ask a question",
    body: "Type a question in plain English, as you would ask a colleague. Each answer shows the cases and passages it relied on. Open each source and check it yourself before you rely on it or file anything.",
    target: ".composer",
  },
  {
    path: "/matters/anderson/deadlines",
    title: "Deadlines",
    body: "Casevex lists the dates that matter for the case. A deadline counts as checked only once an attorney confirms it, so always compare it with the court's own order.",
    target: "main .page-body",
  },
  {
    path: "/notices",
    title: "Notices",
    body: "When a new ruling may affect one of your matters, a notice appears here. It names the matter and explains why the ruling may matter to it.",
    target: ".notice-list",
  },
  {
    path: "/",
    title: "You are ready",
    body: "Practise on the sample cases as long as you like. When you are done, remove them and add your first real matter. You can take this tour again from the banner at the top.",
    target: ".sample-banner",
  },
];
