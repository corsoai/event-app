"use client";

import { FormEvent, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

export function DemoRequestForm() {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Thank you — your request has been noted. The Corsvent team will reach out to arrange your demo.");
    event.currentTarget.reset();
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:p-8">
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">Name</span>
            <input name="name" placeholder="Your full name" required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">Email</span>
            <input name="email" type="email" placeholder="you@example.com" required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">Company / event name</span>
            <input name="estateName" placeholder="e.g. Grand Events Ltd, or your event name" required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">Phone</span>
            <input name="phone" placeholder="+234 800 000 0000" className={inputClass} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-[#1d1d1f]">Message</span>
          <textarea
            name="message"
            rows={4}
            placeholder="What kind of events do you run, and how do you manage guest lists today?"
            className={inputClass}
          />
        </label>
        {message ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
        ) : null}
        <button
          type="submit"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-7 py-3.5 text-[15px] font-semibold text-[#fff] transition hover:bg-emerald-500 sm:w-auto"
        >
          Request a demo
        </button>
      </form>
    </div>
  );
}
