export interface ActorOrderChoice { value: string; caption: string }

// Stored values and presentation order are one actor preference contract.
export const actorOrders: ActorOrderChoice[] = [
  { value: 'playCount', caption: 'actor_order_play' },
  { value: 'watched', caption: 'actor_order_watched' },
  { value: 'unplayed', caption: 'actor_order_unplayed' },
  { value: 'works', caption: 'actor_order_works' },
  { value: 'recent', caption: 'actor_order_recent' },
  { value: 'name', caption: 'actor_order_name' },
  { value: 'recommended', caption: 'actor_order_recommended' },
];

export const defaultActorOrder: string = 'playCount';
