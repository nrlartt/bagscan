import type { TalkContext, TalkHistoryTurn, TalkReply } from "@/lib/talk/types";
import { generateTalkReplyLocal } from "./engine";
import { generateTalkReplyWithOpenClaw, isOpenClawTalkEnabled } from "./openclaw";

export async function generateTalkReply(message: string, wallet?: string, context?: TalkContext, history?: TalkHistoryTurn[]): Promise<TalkReply> {
    if (isOpenClawTalkEnabled()) {
        try {
            return await generateTalkReplyWithOpenClaw(message, wallet, context, history);
        } catch (error) {
            console.error("[talk/openclaw] falling back to local engine:", error);
        }
    }

    return generateTalkReplyLocal(message, wallet, context);
}

export { isOpenClawTalkEnabled };
