import { api } from "@/server/api";
import { json } from "@/server/http";
import { requirePermission } from "@/server/auth";
import { sendTestWebhook } from "@/server/discord";

export const POST = api(async (_request, context) => {
  const user = await requirePermission("discord.manage");
  const { id } = await context.params;
  const result = await sendTestWebhook(id, user);
  return json(result);
});
