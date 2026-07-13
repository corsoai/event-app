import { redirect } from "next/navigation";

// Short, human-typeable address for the exhibition banner. The login page
// hosts the one-tap Africa Secured Estate demo buttons and handles
// /login?demo=<role> QR deep links.
export default function DemoPage() {
  redirect("/login");
}
