/*
Copyright 2026 The Karmada Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { karmadaMemberClusterClient } from '../base';

export async function GetResource(params: UnstructuredParams) {
  const url = generateUrlForUnstructuredParams(params);
  const resp = await karmadaMemberClusterClient.get<{
    data: any;
    code: number;
    message: string;
  }>(url);
  return resp;
}


export async function PutResource(
  params: UnstructuredParams & {
    content: Record<string, any>;
  },
) {
  const url = generateUrlForUnstructuredParams(params);
  const resp = await karmadaMemberClusterClient.put<{
    data: any;
    code: number;
    message: string;
  }>(url, params.content);
  return resp.data;
}


interface UnstructuredParams {
  memberClusterName: string;
  kind: string;
  name: string;
  namespace?: string;
}

function generateUrlForUnstructuredParams(params: UnstructuredParams) {
  const { memberClusterName, kind, name, namespace } = params;
  const segments = [memberClusterName, kind, name, namespace].filter(Boolean) as string[];
  if (segments.some(s => s.includes('..') || s.includes('/') || s.includes('\\'))) {
    throw new Error('Invalid characters in URL path segment. Path traversal sequences (.., /, \\) are not allowed.');
  }
  return namespace ?
      `/clusterapi/${memberClusterName}/api/v1/_raw/${kind}/namespace/${namespace}/name/${name}` : `/clusterapi/${memberClusterName}/api/v1/_raw/${kind}/name/${name}`;
}
