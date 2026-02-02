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

import { GetClusters } from '@/services/cluster';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';

export const useClusters = () => {
  return useQuery({
    queryKey: ['GetClusters'],
    queryFn: async () => {
      const ret = await GetClusters();
      return ret?.data?.clusters || [];
    },
  });
};

export type ClusterContextType = {
  currentCluster: string;
  setCurrentCluster: (currentCluster: string) => void;
};

export const ClusterContext = createContext<ClusterContextType>({
  currentCluster: 'control-plane',
  setCurrentCluster: () => { },
});

export const useCluster = () => {
  return useContext(ClusterContext);
};


type MemberClusterContext = {
  memberClusterName: string;
};

export function useMemberClusterContext(): MemberClusterContext {
  return useOutletContext<MemberClusterContext>();
}
