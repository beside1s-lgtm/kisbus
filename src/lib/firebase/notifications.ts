import { db } from '../firebase';
import { collection, doc, query, where, onSnapshot } from 'firebase/firestore';
import type { NotificationSettings } from '../types';
import { onCollectionUpdate, fetchCollection, setDocument } from './core';

export const getNotificationSettings = () => fetchCollection<NotificationSettings>('notification_settings');

export const onNotificationSettingsUpdate = (callback: (settings: NotificationSettings[]) => void) => 
    onCollectionUpdate<NotificationSettings>('notification_settings', callback);

export const saveNotificationSettings = async (settings: NotificationSettings) => {
    return setDocument('notification_settings', settings.id, {
        ...settings,
        lastModified: new Date().toISOString()
    });
};
