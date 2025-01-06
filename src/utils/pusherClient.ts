import Pusher from 'pusher-js';

export const initializePusher = () => {
    return new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER || 'default-cluster',
    });
};
