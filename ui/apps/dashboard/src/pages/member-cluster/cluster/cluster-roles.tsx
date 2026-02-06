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
  ClusterRole,
  GetMemberClusterClusterRoleDetail,
  GetMemberClusterClusterRoles,
  PolicyRule,
} from '@/services/member-cluster/rbac';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterClusterRoles() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{
    searchText: string;
  }>({
    searchText: '',
  });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<ClusterRole | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterClusterRoles', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterClusterRoles({
        memberClusterName,
        keyword: filter.searchText,
      });
      return ret;
    },
  });

  const formatResources = (rules?: PolicyRule[]) => {
    if (!rules || rules.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const allResources = rules.flatMap(rule => rule.resources || []);
    const uniqueResources = [...new Set(allResources)];

    if (uniqueResources.includes('*')) {
      return <Tag color="red">All Resources</Tag>;
    }

    if (uniqueResources.length <= 3) {
      return (
        <div className="flex flex-wrap gap-1">
          {uniqueResources.map((resource, index) => (
            <Tag key={index} color="blue">{resource}</Tag>
          ))}
        </div>
      );
    }

    return (
      <Tooltip title={uniqueResources.join(', ')}>
        <div className="flex flex-wrap gap-1">
          {uniqueResources.slice(0, 3).map((resource, index) => (
            <Tag key={index} color="blue">{resource}</Tag>
          ))}
          <Tag color="cyan">+{uniqueResources.length - 3}</Tag>
        </div>
      </Tooltip>
    );
  };

  const formatVerbs = (rules?: PolicyRule[]) => {
    if (!rules || rules.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const allVerbs = rules.flatMap(rule => rule.verbs || []);
    const uniqueVerbs = [...new Set(allVerbs)];

    if (uniqueVerbs.includes('*')) {
      return <Tag color="red">All Verbs</Tag>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {uniqueVerbs.slice(0, 4).map((verb, index) => (
          <Tag key={index} color="green">{verb}</Tag>
        ))}
        {uniqueVerbs.length > 4 && <Tag color="cyan">+{uniqueVerbs.length - 4}</Tag>}
      </div>
    );
  };

  const formatLabels = (clusterRole: ClusterRole) => {
    const labels = clusterRole.objectMeta.labels || {};
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

  const columns: TableColumnProps<ClusterRole>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: ClusterRole) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      render: (_: unknown, record: ClusterRole) => formatLabels(record),
    },
    {
      title: 'Rules',
      dataIndex: 'rules',
      key: 'rules',
      render: (_: unknown, record: ClusterRole) => {
        const count = record.rules?.length ?? 0;
        if (count === 0) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <Tag color="orange" icon={<Icons.certificate width={16} height={16} />}>
            {count} rules
          </Tag>
        );
      },
    },
    {
      title: 'Resources',
      dataIndex: 'resources',
      key: 'resources',
      render: (_: unknown, record: ClusterRole) => formatResources(record.rules),
    },
    {
      title: 'Verbs',
      dataIndex: 'verbs',
      key: 'verbs',
      render: (_: unknown, record: ClusterRole) => formatVerbs(record.rules),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: ClusterRole) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ClusterRole) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View ClusterRole details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterClusterRoleDetail({
                  memberClusterName,
                  name: record.objectMeta.name,
                });

                setViewDetail(detailResp as ClusterRole);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load ClusterRole');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit ClusterRole"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName: memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                });
                if (ret.status !== 200) {
                  void messageApi.error(
                    'Failed to load ClusterRole',
                  );
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load ClusterRole');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete ClusterRole"
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
              `${range[0]}-${range[1]} of ${total} cluster roles`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="ClusterRole details"
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
              <div>Labels: {formatLabels(viewDetail)}</div>
            </div>
            <div>
              <div className="font-semibold mb-2">Rules</div>
              <div className="space-y-2">
                {viewDetail.rules.map((rule, index) => (
                  <div key={index} className="border rounded p-2">
                    <div className="font-medium text-sm mb-1">Rule {index + 1}</div>
                    <div className="text-xs space-y-1">
                      <div>Verbs: {rule.verbs.join(', ')}</div>
                      <div>Resources: {rule.resources.join(', ')}</div>
                      {rule.resourceNames && (
                        <div>Resource Names: {rule.resourceNames.join(', ')}</div>
                      )}
                      <div>API Groups: {rule.apiGroups.join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit ClusterRole (YAML)"
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
                      ret.message || 'Failed to update ClusterRole',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update ClusterRole');
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
