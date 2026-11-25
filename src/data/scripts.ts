import { FollowUpScript } from '../types/crm';

export const FOLLOW_UP_SCRIPTS: FollowUpScript[] = [
  {
    id: 'script_9word',
    title: 'Dean Jackson 9-Word Email',
    category: 'Re-engagement',
    preview: 'Are you still looking to buy a home in [City]?',
    template: 'Hi {{name}}, are you still looking to buy a home in {{location}}?\n\nBest,\n{{agentName}}',
  },
  {
    id: 'script_speed_to_lead',
    title: 'Speed-to-Lead Instant Text (<5 Mins)',
    category: 'First Touch',
    preview: 'Hi [Name], saw you were looking at homes in [Area]...',
    template: 'Hi {{name}}! Just saw you were checking out homes in {{location}}. Are you looking to make a move in the next 30-60 days, or just browsing the market?\n\n- {{agentName}}',
  },
  {
    id: 'script_off_market',
    title: 'Off-Market / Sneak Peek Alert',
    category: 'Showing',
    preview: 'I have a home coming on the market near [Area]...',
    template: 'Hey {{name}}, a property that matches your criteria ({{criteria}}) might be coming up near {{location}} before it hits the MLS. Do you want me to send over the photos and details before anyone else sees it?\n\n- {{agentName}}',
  },
  {
    id: 'script_showing_feedback',
    title: 'Post-Tour Showing Debrief',
    category: 'Showing',
    preview: 'Quick thoughts on today’s tour? What did you love/hate?',
    template: 'Hi {{name}}, great touring with you today! On a scale of 1-10, how did that last home compare to what you envision? Any dealbreakers we should eliminate on our next run?\n\n- {{agentName}}',
  },
  {
    id: 'script_price_drop',
    title: 'Price Adjustment Opportunity',
    category: 'Price Drop',
    preview: 'A home you looked at just had a price correction...',
    template: 'Hey {{name}}, good news! That home in {{location}} just had a price reduction down to {{price}}. At this number, the seller may be motivated to negotiate on closing credits too. Worth a second look?\n\n- {{agentName}}',
  },
  {
    id: 'script_seller_equity',
    title: 'Homeowner Equity / CMA Quick Note',
    category: 'Past Client',
    preview: 'A neighbor home just sold for record price...',
    template: 'Hi {{name}}, a property right on your street just went pending at a strong price. Home values in your pocket have shifted recently. Would you like a 1-page updated equity snapshot just so you know where you stand?\n\n- {{agentName}}',
  },
];
