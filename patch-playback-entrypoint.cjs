const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/components/ConversationWorkspace.tsx',s=>{
 const marker='</Label>\n              </View>)}';if(!s.includes(marker))throw Error('Attachment branch not found');
 return s.replace(marker, `</Label>
                {a.status === 'ready' && (a.kind === 'audio' || a.kind === 'video') && <Button title={\`Open media \${a.name}\`} onPress={() => setMedia(a)} />}
                {a.status === 'ready' && a.kind === 'image' && <Button title={\`View image \${a.name}\`} onPress={() => setImage(a)} />}
              </View>)}`);
});
edit('src/components/VaultPanel.tsx',s=>{
s=s.replace("const [custom, setCustom] = useState('')", "const [custom, setCustom] = useState<{ id: string; name: string; value: string }[]>([])").replaceAll("setCustom('')",'setCustom([])');
s=s.replace("const fields: unknown = custom.trim() ? JSON.parse(custom) : undefined\n      if (fields && (typeof fields !== 'object' || Array.isArray(fields) || Object.values(fields).some(value => typeof value !== 'string' && value !== null))) throw new Error('Custom fields must be a JSON object containing text values or null.')", "if (custom.some(field => !field.name.trim()) || new Set(custom.map(field => field.name.trim())).size !== custom.length) throw new Error('Give each custom field a unique name.')\n      const fields = custom.length ? Object.fromEntries(custom.map(field => [field.name.trim(), field.value])) : undefined");
const marker='<Field label="Custom secret fields (JSON object)" secureTextEntry value={custom} onChangeText={setCustom} autoComplete="off" />';if(!s.includes(marker))throw Error('Custom field form not found');
s=s.replace(marker, `{custom.map((field, index) => <Card key={field.id}><Field label={\`Custom field \${index + 1} name\`} value={field.name} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, name: value } : item))} /><Field label={\`Custom field \${index + 1} value\`} secureTextEntry autoComplete="off" value={field.value} onChangeText={value => setCustom(items => items.map(item => item.id === field.id ? { ...item, value } : item))} /><Button title={\`Remove custom field \${index + 1}\`} onPress={() => setCustom(items => items.filter(item => item.id !== field.id))} /></Card>)}
    <Button title="Add custom secret field" onPress={() => setCustom(items => [...items, { id: randomUUID(), name: '', value: '' }])} />`);return s;
});
