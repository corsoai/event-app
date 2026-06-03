"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";

export function DemoRequestForm() {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Demo request saved. For now, continue by creating a resident access request or contacting the Corso team.");
    event.currentTarget.reset();
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><Input name="name" placeholder="Estate manager" required /></Field>
          <Field label="Email"><Input name="email" type="email" placeholder="manager@example.com" required /></Field>
          <Field label="Estate name"><Input name="estateName" placeholder="LBS View Estate" required /></Field>
          <Field label="Phone"><Input name="phone" placeholder="+234 800 000 0000" /></Field>
        </div>
        <div className="mt-4">
          <Field label="Message"><Textarea name="message" placeholder="Tell us about your estate size and current process." /></Field>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="mt-5">Request Demo</Button>
      </form>
    </Card>
  );
}
