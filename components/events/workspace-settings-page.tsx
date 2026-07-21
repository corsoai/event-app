"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { readDisabledEstateModules, saveDisabledEstateModules } from "@/lib/appwrite/browser-data";

const MODULE_OPTIONS: Array<{ key: string; label: string; helper: string }> = [
  {
    key: "guard_tour",
    label: "Venue Patrols",
    helper: "QR checkpoint patrols for security staff at large venues, with GPS verification."
  },
  {
    key: "plate_capture",
    label: "VIP Parking",
    helper: "Register expected VIP plates per event and log arrivals at the car gate. (Feature in development.)"
  }
];

export function WorkspaceSettingsPage() {
  const [disabled, setDisabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    readDisabledEstateModules()
      .then((value) => {
        if (active) setDisabled(value);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Module settings could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleModule(key: string) {
    setDisabled((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveDisabledEstateModules(disabled);
      setDisabled(saved);
      setMessage("Settings saved. Staff will see the change when they next open or refresh the app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Switch optional features on or off for this workspace." />
      <Card>
        <CardHeader
          title="Optional features"
          description="Switched-off features disappear from menus and dashboards for everyone in this workspace."
        />
        {loading ? (
          <p className="text-sm text-slate-300">Loading settings...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {MODULE_OPTIONS.map((option) => {
              const isOn = !disabled.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleModule(option.key)}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-4 text-left transition ${
                    isOn ? "border-smart/40 bg-smart/10" : "border-white/10 bg-white/5 opacity-70"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{option.helper}</span>
                  </span>
                  <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    isOn ? "border-smart/40 bg-smart/15 text-smart" : "border-white/20 bg-white/10 text-slate-300"
                  }`}>
                    {isOn ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="mt-5" type="button" disabled={saving || loading} onClick={() => void save()}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </Card>
    </>
  );
}
