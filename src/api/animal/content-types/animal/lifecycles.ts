import type { Core } from '@strapi/strapi'

export default {
  async afterUpdate(event: { result: { id: number; documentId: string; status: string }; params: any }) {
    const { result } = event
    if (result.status === 'in_foster') return

    const strapi = (global as any).strapi as Core.Strapi

    const assignments = await strapi.documents('api::foster-assignment.foster-assignment').findMany({
      filters: {
        animal: { documentId: result.documentId },
        status: 'active',
      },
    })

    for (const assignment of assignments) {
      await strapi.documents('api::foster-assignment.foster-assignment').update({
        documentId: assignment.documentId,
        data: {
          status: 'completed',
          end_date: new Date().toISOString().split('T')[0],
        },
      })
    }
  },
}
