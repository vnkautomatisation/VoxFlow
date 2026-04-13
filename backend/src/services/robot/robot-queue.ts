/**
 * Robot Dialer — Redis Queue Management
 *
 * Utilise Upstash Redis (REST API) pour la queue distribuee.
 * Chaque campagne ACTIVE a une queue Redis "robot:{campaignId}" qui
 * contient les IDs des leads PENDING a appeler.
 *
 * Architecture :
 *  - enqueue() : pousser les leads d'une campagne dans Redis
 *  - dequeue() : prendre le prochain batch de leads
 *  - stats()   : compter les leads restants dans la queue
 *  - clear()   : vider la queue (quand pause/stop)
 */

import { Redis } from "@upstash/redis"

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

const QUEUE_PREFIX = "robot:queue:"
const ACTIVE_KEY   = "robot:active_campaigns"

export const robotQueue = {
  /**
   * Pousser un batch de lead IDs dans la queue d'une campagne.
   */
  async enqueue(campaignId: string, leadIds: string[]): Promise<number> {
    if (!leadIds.length) return 0
    const key = QUEUE_PREFIX + campaignId
    const result = await redis.rpush(key, ...leadIds)
    // Marquer la campagne comme active
    await redis.sadd(ACTIVE_KEY, campaignId)
    return result
  },

  /**
   * Prendre les N prochains leads de la queue.
   */
  async dequeue(campaignId: string, count: number = 10): Promise<string[]> {
    const key = QUEUE_PREFIX + campaignId
    const results: string[] = []
    for (let i = 0; i < count; i++) {
      const id = await redis.lpop<string>(key)
      if (!id) break
      results.push(id)
    }
    return results
  },

  /**
   * Nombre de leads restants dans la queue.
   */
  async remaining(campaignId: string): Promise<number> {
    return redis.llen(QUEUE_PREFIX + campaignId)
  },

  /**
   * Vider la queue (pause/stop).
   */
  async clear(campaignId: string): Promise<void> {
    await redis.del(QUEUE_PREFIX + campaignId)
    await redis.srem(ACTIVE_KEY, campaignId)
  },

  /**
   * Liste des campagnes actuellement actives (ont des leads en queue).
   */
  async activeCampaigns(): Promise<string[]> {
    const members = await redis.smembers(ACTIVE_KEY)
    return members as string[]
  },

  /**
   * Marquer une campagne comme inactive (queue epuisee).
   */
  async deactivate(campaignId: string): Promise<void> {
    await redis.srem(ACTIVE_KEY, campaignId)
  },
}
