import { errorMessage } from '../../core/api/client'
import { ChatLockController } from './chatLockController'
import { setConversationLock, verifyLockedChats } from './chatLockApi'
export const chatLock = new ChatLockController({ verify: verifyLockedChats, update: setConversationLock, message: errorMessage })
