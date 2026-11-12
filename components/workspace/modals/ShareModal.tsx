"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Share a matter. */
export default function ShareModal() {
  const { setModal, notify } = useWorkspace();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setModal("");
        notify("Demo only: sharing preview completed. No invitation was sent.");
      }}
    >
      <p>
        Preview a matter invitation. No email is sent and no access is granted.
      </p>
      <label>
        Email
        <input type="email" required name="email" />
      </label>
      <label>
        Access
        <select>
          <option>Can view</option>
          <option>Can edit</option>
        </select>
      </label>
      <button className="primary">Preview invitation</button>
    </form>
  );
}
