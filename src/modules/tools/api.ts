import { api } from '../../core/api/client'
export interface SoftwareTool { id: string; name: string; description: string; web_url: string; app_url: string; position: number; is_active: boolean }
export type ToolInput = Omit<SoftwareTool, 'id'>
export const listTools = async (manage = false) => (await api.get<SoftwareTool[]>(manage ? '/admin/tools/' : '/tools/')).data
export const saveTool = async (id: string | null, data: ToolInput) => id ? api.patch(`/admin/tools/${id}/`, data) : api.post('/admin/tools/', data)
export const hideTool = async (id: string) => api.delete(`/admin/tools/${id}/`)
