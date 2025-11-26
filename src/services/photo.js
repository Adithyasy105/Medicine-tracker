import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase, storageBucket } from '../lib/supabase';

export const captureOrPickImage = async () => {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (cameraStatus !== 'granted' && mediaStatus !== 'granted') {
    throw new Error('Camera or photo library permission is required');
  }

  const mediaType = ImagePicker.MediaType?.IMAGE ?? ImagePicker.MediaTypeOptions?.Images;

  const camera = await ImagePicker.launchCameraAsync({
    mediaTypes: mediaType ? [mediaType] : undefined,
    quality: 0.6,
  });
  if (!camera.canceled) return camera.assets[0];

  const library = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: mediaType ? [mediaType] : undefined,
    quality: 0.8,
  });
  if (library.canceled) return null;
  return library.assets[0];
};

export const uploadImageAsync = async (fileUri, userId) => {
  const fileExt = fileUri.split('.').pop();
  const fileName = `user_uploads/${userId}/${Date.now()}.${fileExt}`;
  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(fileName, decodeBase64(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return fileName;
};

export const invokeScanFunction = async (imagePath) => {
  const { data, error } = await supabase.functions.invoke('scanMedicine', {
    body: { imagePath },
  });
  if (error) throw error;
  return data;
};

