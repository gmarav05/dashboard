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
  Space,
  Table,
  TableColumnProps,
  Tag,
  Tooltip,
} from 'antd';
import { Icons } from '@/components/icons';
import { useMemberClusterContext } from '@/hooks';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PersistentVolume,
  GetMemberClusterPersistentVolumeDetail,
  GetMemberClusterPersistentVolumes,
} from '@/services/member-cluster/storage';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterPersistentVolumes() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{
    searchText: string;
  }>({
    searchText: '',
  });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<PersistentVolume | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterPersistentVolumes', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterPersistentVolumes({
        memberClusterName,
        keyword: filter.searchText,
      });
      return ret;
    },
  });

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      'Available': { color: 'default', icon: <Icons.cloud width={16} height={16} /> },
      'Bound': { color: 'success', icon: <Icons.storage width={16} height={16} /> },
      'Released': { color: 'warning', icon: <Icons.storage width={16} height={16} /> },
      'Failed': { color: 'error', icon: <Icons.storage width={16} height={16} /> }
    };

    const config = statusConfig[status] || { color: 'default', icon: <Icons.storage width={16} height={16} /> };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  const getReclaimPolicyTag = (policy: string) => {
    const policyColors: Record<string, string> = {
      'Retain': 'blue',
      'Delete': 'orange',
      'Recycle': 'purple'
    };

    return (
      <Tag color={policyColors[policy] || 'default'}>
        {policy}
      </Tag>
    );
  };

  const getStorageClassTag = (storageClass: string) => {
    if (!storageClass) {
      return <span className="text-gray-400">-</span>;
    }

    const classColors: Record<string, string> = {
      'fast-ssd': 'red',
      'standard': 'blue',
      'slow-hdd': 'orange'
    };

    const color = classColors[storageClass] || 'default';
    return (
      <Tag color={color}>
        {storageClass}
      </Tag>
    );
  };

  const formatAccessModes = (modes: string[]) => {
    const modeAbbrev: Record<string, string> = {
      'ReadWriteOnce': 'RWO',
      'ReadOnlyMany': 'ROX',
      'ReadWriteMany': 'RWX'
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

  const formatClaim = (claim: string, status: string) => {
    if (!claim || status === 'Available') {
      return <span className="text-gray-400">Unbound</span>;
    }

    return (
      <code className="text-xs">{claim}</code>
    );
  };

  const formatCapacity = (capacity: Record<string, string>) => {
    if (!capacity || Object.keys(capacity).length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const storageValue = capacity.storage || Object.values(capacity)[0] || '-';
    return <code className="text-xs">{storageValue}</code>;
  };

  const formatLabels = (pv: PersistentVolume) => {
    const labels = pv.objectMeta.labels || {};
    const entries = Object.entries(labels);
    if (!entries.length) {
      return <span className="text-gray-400">-</span>;
    }
    const first = `${entries[0][0]}=${entries[0][1]}`;
    const remaining = entries.length - 1;

    if (entries.length === 1) {
      return (
        <Tag color="geekblue" className="text-xs">
          {first}
        </Tag>
      );
    }

    const full = entries.map(([k, v]) => `${k}=${v}`).join(', ');

    return (
      <Tooltip title={full}>
        <div className="flex items-center gap-1">
          <Tag color="geekblue" className="text-xs">
            {first}
          </Tag>
          <Tag color="purple">+{remaining}</Tag>
        </div>
      </Tooltip>
    );
  };

  const columns: TableColumnProps<PersistentVolume>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: PersistentVolume) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      render: (_: unknown, record: PersistentVolume) => formatLabels(record),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (_: string, record: PersistentVolume) => getStatusTag(record.status),
    },
    {
      title: 'Claim',
      key: 'claim',
      render: (_: unknown, record: PersistentVolume) => formatClaim(record.claim, record.status),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (_: unknown, record: PersistentVolume) => formatCapacity(record.capacity),
    },
    {
      title: 'Access Modes',
      dataIndex: 'accessModes',
      key: 'accessModes',
      render: (_: unknown, record: PersistentVolume) => formatAccessModes(record.accessModes),
    },
    {
      title: 'Reclaim Policy',
      dataIndex: 'reclaimPolicy',
      key: 'reclaimPolicy',
      render: (_: unknown, record: PersistentVolume) => getReclaimPolicyTag(record.reclaimPolicy),
    },
    {
      title: 'Storage Class',
      dataIndex: 'storageClass',
      key: 'storageClass',
      render: (_: unknown, record: PersistentVolume) => getStorageClassTag(record.storageClass),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: PersistentVolume) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: PersistentVolume) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View PersistentVolume details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterPersistentVolumeDetail({
                  memberClusterName,
                  name: record.objectMeta.name,
                });

                setViewDetail(detailResp as PersistentVolume);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load PersistentVolume');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit PersistentVolume"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName: memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                });
                if (ret.status !== 200) {
                  void messageApi.error(
                    'Failed to load PersistentVolume',
                  );
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load PersistentVolume');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete PersistentVolume"
            disabled={record.status === 'Bound'}
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
          rowKey={(record) => record.objectMeta.name}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} persistent volumes`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="PersistentVolume details"
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
              <div>
                Created:{' '}
                {viewDetail.objectMeta?.creationTimestamp
                  ? dayjs(viewDetail.objectMeta.creationTimestamp).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : '-'}
              </div>
              <div>Status: {getStatusTag(viewDetail.status)}</div>
              <div>Labels: {formatLabels(viewDetail)}</div>
            </div>
            <div>
              <div className="font-semibold mb-2">Storage Details</div>
              <div>Capacity: {formatCapacity(viewDetail.capacity)}</div>
              <div>Access Modes: {formatAccessModes(viewDetail.accessModes)}</div>
              <div>Reclaim Policy: {getReclaimPolicyTag(viewDetail.reclaimPolicy)}</div>
              <div>Storage Class: {getStorageClassTag(viewDetail.storageClass)}</div>
              <div>Claim: {formatClaim(viewDetail.claim, viewDetail.status)}</div>
              {viewDetail.reason && (
                <div>Reason: <code className="text-xs">{viewDetail.reason}</code></div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit PersistentVolume (YAML)"
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

                  const ret = await PutResource({
                    memberClusterName: memberClusterName,
                    kind,
                    name,
                    namespace: '',
                    content: yamlObject,
                  });

                  if (ret.code !== 200) {
                    void messageApi.error(
                      ret.message || 'Failed to update PersistentVolume',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update PersistentVolume');
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
