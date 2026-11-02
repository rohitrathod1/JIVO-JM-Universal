export interface MediaSource { uri: string; headers?: Record<string, string> }
// The browser attaches HttpOnly cookies with the player's use-credentials option.
export async function authenticatedMediaSource(uri: string): Promise<MediaSource> { return { uri } }
