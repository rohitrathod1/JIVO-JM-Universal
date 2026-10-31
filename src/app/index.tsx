import { Link, type Href } from 'expo-router'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { homeTiles } from '../shared/homeTiles'
import { Card, Label, styles, useColors } from '../ui'
export default function Index() {
 const { me } = useSession(); const { width } = useWindowDimensions(); const c = useColors()
 return <Workspace><ScrollView contentContainerStyle={styles.page}><Label large>Welcome, {me?.name || 'there'}</Label><Label>What would you like to do?</Label><View style={{ flexDirection:'row',flexWrap:'wrap',gap:16 }}>{homeTiles(me?.capabilities ?? []).map(tile => <View key={tile.title} style={{ width: width < 700 ? '100%' : '46%', maxWidth:480 }}><Card><Link href={tile.href as Href} style={{ color:c.primary,fontSize:22,fontWeight:'700',paddingVertical:12 }}>{tile.title}</Link><Label>{tile.description}</Label></Card></View>)}</View></ScrollView></Workspace>
}
