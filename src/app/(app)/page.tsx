import { redirect } from "next/navigation";

// La home vera è /home: qui reindirizziamo per evitare due pagine duplicate.
export default function AppIndexPage() {
  redirect("/home");
}
