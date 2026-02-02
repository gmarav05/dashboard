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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataSelectQuery } from '@/services/base.ts';
import { GetMemberClusterNamespaces } from '@/services/member-cluster/namespace.ts';

const useMemberClusterNamespace = (props: {
  memberClusterName: string;
  nsFilter?: DataSelectQuery;
}) => {
  const { nsFilter = {}, memberClusterName } = props;
  const {
    data: nsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['GetNamespaces', nsFilter, memberClusterName],
    queryFn: async () => {
      const response = await GetMemberClusterNamespaces({
        ...nsFilter,
        memberClusterName: memberClusterName,
      });
      return response.data || {};
    },
  });
  const nsOptions = useMemo(() => {
    if (!nsData?.namespaces) return [];
    return nsData.namespaces.map((item) => {
      return {
        title: item.objectMeta.name,
        value: item.objectMeta.name,
      };
    });
  }, [nsData]);
  return {
    nsOptions,
    isNsDataLoading: isLoading,
    refetchNsData: refetch,
  };
};

export default useMemberClusterNamespace;
