import { Client, Messaging, ID } from "node-appwrite";

const patrolEventsTableId = "guard_patrol_events";

export default async function ({ req, res, log, error }) {
  const event = req.bodyJson ?? {};
  const patrol = event.$id ? event : event.payload ?? event.document ?? {};
  const tableId = patrol.$tableId || patrol.$collectionId || event.tableId || event.collectionId || "";

  if (tableId && tableId !== patrolEventsTableId) {
    return res.json({ success: true, skipped: true, reason: "not_guard_patrol_events" });
  }

  if (patrol.isGpsVerified === true) {
    return res.json({ success: true, skipped: true });
  }

  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const managementTeamId = process.env.MANAGEMENT_TEAM_ID;
  const endpoint = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";

  if (!projectId || !apiKey || !managementTeamId) {
    error("Missing function environment variables for CSO patrol alert.");
    return res.json({ success: false, error: "Missing function configuration." }, 500);
  }

  const guardName = patrol.guardName || "Security Guard";
  const checkpointName = patrol.checkpointName || patrol.checkpointCode || "checkpoint";
  const distance = patrol.distanceMeters === undefined ? "unknown distance" : `${patrol.distanceMeters}m`;
  const radius = patrol.allowedRadius === undefined ? "configured radius" : `${patrol.allowedRadius}m radius`;
  const body = `${guardName} scanned ${checkpointName} outside GPS range (${distance}; ${radius}).`;

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const messaging = new Messaging(client);

  await messaging.createPush({
    messageId: ID.unique(),
    title: "Guard tour GPS warning",
    body,
    topics: [managementTeamId]
  });

  log(body);
  return res.json({ success: true });
}
