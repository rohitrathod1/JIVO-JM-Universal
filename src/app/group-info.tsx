import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { ConversationDetails } from '../components/ConversationDetails'
import { useSession } from '../core/auth/Session'
import { Spinner } from '../ui'

export default function GroupInfoPage() {
 const { conversation } = useLocalSearchParams<{ conversation?: string }>()
 const { me, status } = useSession()
 if (status === 'loading' || status === 'signing-out') return <Spinner />
 if (!me) return <Redirect href="/login" />
 if (!conversation || typeof conversation !== 'string') return <Redirect href="/messenger" />
 const back = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/messenger', params: { conversation } }) }
 return <ConversationDetails key={conversation} page conversation={conversation} onClose={back} onChanged={() => {}} onClear={() => {}} onLeave={() => router.replace('/messenger')} />
}
