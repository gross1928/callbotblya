import { Markup } from 'telegraf';
import type { CustomContext } from '../types';

/**
 * Edit message if it's a callback query, otherwise send new message
 * This reduces message spam by editing existing messages when possible
 * Always removes reply keyboard
 */
export async function editOrReply(ctx: CustomContext, text: string, keyboard?: any): Promise<void> {
  try {
    // If this is a callback query (button press), try to edit the message
    if (ctx.callbackQuery && 'message' in ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
        ...Markup.removeKeyboard()
      });
    } else {
      // Otherwise send a new message with removed keyboard
      await ctx.replyWithHTML(text, { ...keyboard, ...Markup.removeKeyboard() });
    }
  } catch (error: any) {
    // If editing fails (message too old, not modified, or not found), send new message
    if (error.description?.includes('message is not modified') || 
        error.description?.includes('message to edit not found') ||
        error.description?.includes('message can\'t be edited')) {
      await ctx.replyWithHTML(text, { ...keyboard, ...Markup.removeKeyboard() });
    } else {
      // Log unexpected errors but still try to send a new message
      console.error('[editOrReply] Unexpected error:', error);
      await ctx.replyWithHTML(text, { ...keyboard, ...Markup.removeKeyboard() });
    }
  }
}
