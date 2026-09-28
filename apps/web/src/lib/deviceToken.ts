import { DeviceType, ActiveDeviceSession } from '@synccinema/common';

const DEVICE_ID_KEY = 'watch_device_id_v1';
const DEVICE_TOKEN_KEY = 'watch_device_token_v1';

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }
  const ua = navigator.userAgent || '';
  if (/iPad|tablet|PlayBook|Silk/i.test(ua)) {
    return 'tablet';
  }
  if (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return 'mobile';
  }
  if (window.innerWidth <= 768 && 'ontouchstart' in window) {
    return 'mobile';
  }
  return 'desktop';
}

export function getBrowserName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'browser';
  }
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  return 'Browser';
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'ssr_device';
  }
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const type = getDeviceType();
      id = `dev_${type}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_fallback_${Date.now().toString(36)}`;
  }
}

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') {
    return 'ssr_token';
  }
  try {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      const devId = getOrCreateDeviceId();
      token = `token_${devId}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return `token_fallback_${Date.now().toString(36)}`;
  }
}

export interface ClientDeviceInfo {
  deviceId: string;
  deviceType: DeviceType;
  deviceToken: string;
  browserName: string;
}

export function getClientDeviceInfo(): ClientDeviceInfo {
  return {
    deviceId: getOrCreateDeviceId(),
    deviceType: getDeviceType(),
    deviceToken: getOrCreateDeviceToken(),
    browserName: getBrowserName()
  };
}
