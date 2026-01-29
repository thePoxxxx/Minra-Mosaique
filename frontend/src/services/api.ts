import axios from 'axios';
import type { Algorithm, ExportFormat, UploadResponse, DemosaicResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function demosaicImage(
  sessionId: string,
  algorithm: Algorithm
): Promise<DemosaicResponse> {
  const response = await api.post<DemosaicResponse>('/demosaic', {
    session_id: sessionId,
    algorithm,
  });

  return response.data;
}

export async function exportMosaiced(
  sessionId: string,
  format: ExportFormat,
  quality: number
): Promise<Blob> {
  const response = await api.post(
    '/export',
    {
      session_id: sessionId,
      format,
      quality,
    },
    {
      responseType: 'blob',
    }
  );

  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/session/${sessionId}`);
}
