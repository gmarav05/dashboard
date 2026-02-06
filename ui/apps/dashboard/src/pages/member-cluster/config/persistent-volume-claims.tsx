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

import {
  App,
  Button,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
} from 'antd';
import { Icons } from '@/components/icons';
import React from 'react';
import { useMemberClusterContext, useMemberClusterNamespace } from '@/hooks';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PersistentVolumeClaim,
  PersistentVolumeClaimDetail,
  GetMemberClusterPersistentVolumeClaimDetail,
  GetMemberClusterPersistentVolumeClaims,
} from '@/services/member-cluster/config';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterPersistentVolumeClaims() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{
    selectedWorkSpace: string;
    searchText: string;
  }>({
    selectedWorkSpace: '',
    searchText: '',
  });

  const { nsOptions, isNsDataLoading } = useMemberClusterNamespace({ memberClusterName });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<PersistentVolumeClaimDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterPersistentVolumeClaims', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterPersistentVolumeClaims({
        memberClusterName,
        namespace: filter.selectedWorkSpace,
        keyword: filter.searchText,
      });
      // service returns IResponse<...>
      return ret.data;
    },
  });

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      Bound: { color: 'success', icon: <Icons.storage width={16} height={16} /> },
      Pending: { color: 'processing', icon: <Icons.cloud width={16} height={16} /> },
      Lost: { color: 'error', icon: <Icons.storage width={16} height={16} /> },
      Available: { color: 'default', icon: <Icons.storage width={16} height={16} /> },
    };

    const config = statusConfig[status] || {
      color: 'default',
      icon: <Icons.storage width={16} height={16} />,
    };

    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  const formatAccessModes = (modes: string[]) => {
    const modeAbbrev: Record<string, string> = {
      ReadWriteOnce: 'RWO',
      ReadOnlyMany: 'ROX',
      ReadWriteMany: 'RWX',
    };

    return (
      <div className="flex gap-1">
        {modes.map((mode, index) => (
          <Tag key={index} color="geekblue">
            {modeAbbrev[mode] || mode}
          </Tag>
        ))}
      </div>
    );
  };

  const formatCapacity = (capacity: Record<string, string>) => {
    if (!capacity || Object.keys(capacity).length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    // Get the storage value (usually storage key)
    const storageValue = capacity.storage || Object.values(capacity)[0] || '-';
    return <code className="text-xs">{storageValue}</code>;
  };

  const formatVolume = (volume: string, status: string) => {
    if (status !== 'Bound' || !volume) {
      return <span className="text-gray-400">Not bound</span>;
    }
    return <code className="text-xs">{volume}</code>;
  };

  const getStorageClassTag = (storageClass: string) => {
    if (!storageClass) {
      return <span className="text-gray-400">-</span>;
    }

    const classColors: Record<string, string> = {
      'fast-ssd': 'red',
      'standard': 'blue',
      'slow-hdd': 'orange',
    };

    const color = classColors[storageClass] || 'default';
    return (
      <Tag color={color}>
        {storageClass}
      </Tag>
    );
  };

  const columns: TableColumnProps<PersistentVolumeClaim>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: PersistentVolumeClaim) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (_: string, record: PersistentVolumeClaim) => record.objectMeta.namespace,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_: string, record: PersistentVolumeClaim) => getStatusTag(record.status),
    },
    {
      title: 'Volume',
      key: 'volume',
      render: (_: unknown, record: PersistentVolumeClaim) => formatVolume(record.volume, record.status),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (_: unknown, record: PersistentVolumeClaim) => formatCapacity(record.capacity),
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      key: 'accessModes',
      render: (_: unknown, record: PersistentVolumeClaim) => formatAccessModes(record.accessModes),
    },
    {
      title: 'Storage Class',
      dataIndex: 'storageClass',
      key: 'storageClass',
      render: (_: unknown, record: PersistentVolumeClaim) => getStorageClassTag(record.storageClass),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: PersistentVolumeClaim) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: PersistentVolumeClaim) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View PVC details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterPersistentVolumeClaimDetail({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                });

                setViewDetail(detailResp.data as PersistentVolumeClaimDetail);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load PersistentVolumeClaim');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit PVC"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName: memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: record.objectMeta.namespace,
                });
                if (ret.status !== 200) {
                  void messageApi.error(
                    'Failed to load PersistentVolumeClaim',
                  );
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load PersistentVolumeClaim');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete PVC"
            disabled
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className={"flex flex-row space-x-4 mb-4"}>
        <h3 className={"leading-[32px]"}>Namespace:</h3>
        <Select
          options={nsOptions}
          className={"min-w-[200px]"}
          value={filter.selectedWorkSpace}
          loading={isNsDataLoading}
          showSearch
          allowClear
          onChange={(v) => {
            setFilter({
              ...filter,
              selectedWorkSpace: v,
            });
          }}
        />
        <Input.Search
          placeholder="Search by name"
          className={"w-[300px]"}
          onPressEnter={(e) => {
            const input = e.currentTarget.value;
            setFilter({
              ...filter,
              searchText: input,
            });
          }}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <Table
          columns={columns}
          dataSource={data?.items || []}
          rowKey={(record) =>
            `${record.objectMeta.namespace}-${record.objectMeta.name}`
          }
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} persistent volume claims`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="PersistentVolumeClaim details"
        placement="right"
        width={800}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewDetail(null);
        }}
        destroyOnClose
      >
        {viewLoading && <div>Loading...</div>}
        {!viewLoading && viewDetail && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold mb-2">Basic Info</div>
              <div>Name: {viewDetail.objectMeta?.name}</div>
              <div>Namespace: {viewDetail.objectMeta?.namespace}</div>
              <div>Status: {getStatusTag(viewDetail.status)}</div>
              <div>Volume: {formatVolume(viewDetail.volume, viewDetail.status)}</div>
              <div>Capacity: {formatCapacity(viewDetail.capacity)}</div>
              <div>
                Created:{' '}
                {viewDetail.objectMeta?.creationTimestamp
                  ? dayjs(viewDetail.objectMeta.creationTimestamp).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : '-'}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Storage Details</div>
              <div>Access Modes: {formatAccessModes(viewDetail.accessModes)}</div>
              <div>Storage Class: {getStorageClassTag(viewDetail.storageClass)}</div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit PersistentVolumeClaim (YAML)"
        placement="right"
        width={900}
        open={editDrawerOpen}
        onClose={() => {
          if (!editSubmitting) {
            setEditDrawerOpen(false);
            setEditContent('');
          }
        }}
        destroyOnClose
        extra={
          <Space>
            <Button
              type="primary"
              loading={editSubmitting}
              onClick={async () => {
                setEditSubmitting(true);
                try {
                  const yamlObject = parse(editContent) as Record<string, any>;
                  const kind = (yamlObject.kind || '') as string;
                  const metadata = (yamlObject.metadata || {}) as {
                    name?: string;
                    namespace?: string;
                  };
                  const name = metadata.name || '';
                  const namespace = metadata.namespace || '';

                  const ret = await PutResource({
                    memberClusterName: memberClusterName,
                    kind,
                    name,
                    namespace,
                    content: yamlObject,
                  });

                  if (ret.code !== 200) {
                    void messageApi.error(
                      ret.message || 'Failed to update PersistentVolumeClaim',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update PersistentVolumeClaim');
                } finally {
                  setEditSubmitting(false);
                }
              }}
            >
              Save
            </Button>
          </Space>
        }
      >
        <Editor
          height="600px"
          defaultLanguage="yaml"
          value={editContent}
          theme="vs"
          options={{
            theme: 'vs',
            lineNumbers: 'on',
            fontSize: 14,
            minimap: { enabled: false },
            wordWrap: 'on',
          }}
          onChange={(value) => setEditContent(value || '')}
        />
      </Drawer>
    </div>
  );
}
