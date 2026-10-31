export function customSecretFields(custom: { name: string; value: string }[], removed: string[] = []) {
  const fields: Record<string, string | null> = Object.create(null)
  custom.filter(field => field.name.trim() && field.value).forEach(field => { fields[field.name.trim()] = field.value })
  removed.forEach(name => { fields[name] = null })
  return Object.keys(fields).length ? fields : undefined
}
