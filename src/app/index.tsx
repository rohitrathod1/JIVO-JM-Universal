import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { landingRoute } from '../shared/authNavigation'
export default function Index() {
 const { me, status } = useSession()
 return status === 'ready' && me ? <Redirect href={landingRoute(me.capabilities)} /> : <Workspace><View /></Workspace>
}
