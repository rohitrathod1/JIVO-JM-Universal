import { useCallback } from 'react'
import { Image, Linking, Text, View } from 'react-native'
import { firstLink, segments } from '../modules/messenger/lib/text'
import { getLinkPreview } from '../modules/messenger/api'
import { useResource } from '../shared/useResource'
import { Label, useColors } from '../ui'
export function RichMessage({body,mentions=[]}:{body:string;mentions?:string[]}){
 const c=useColors();const url=firstLink(body);const load=useCallback(()=>url?getLinkPreview(url):Promise.resolve(null),[url]);const preview=useResource(load).value
 const image=preview?.image && preview.image.length<=350000 && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(preview.image)?preview.image:null
 return <View style={{gap:6}}><Text style={{color:c.text,fontSize:16,lineHeight:24}}>{segments(body,mentions).map((s,i)=>s.type==='link'?<Text key={i} accessibilityRole="link" onPress={()=>void Linking.openURL(s.href).catch(()=>{})} style={{color:c.primary,textDecorationLine:'underline'}}>{s.value}</Text>:<Text key={i} style={s.type==='mention'?{fontWeight:'700',color:c.primary}:undefined}>{s.value}</Text>)}</Text>{preview&&<View style={{padding:10,borderWidth:1,borderColor:c.border,borderRadius:8}}><Label>{preview.title || preview.domain}</Label><Label>{preview.description}</Label>{image&&<Image accessibilityLabel="Link preview" source={{uri:image}} style={{width:160,height:90}}/>}</View>}</View>
}
