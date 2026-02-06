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
  ClusterRoleBinding,
  GetMemberClusterClusterRoleBindingDetail,
  GetMemberClusterClusterRoleBindings,
  RoleRef,
  Subject,
} from '@/services/member-cluster/rbac';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterClusterRoleBindings() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();

  const [filter, setFilter] = useState<{
    searchText: string;
  }>({
    searchText: '',
  });

  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<ClusterRoleBinding | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetMemberClusterClusterRoleBindings', memberClusterName, filter],
    queryFn: async () => {
      const ret = await GetMemberClusterClusterRoleBindings({
        memberClusterName,
        keyword: filter.searchText,
      });
      return ret;
    },
  });

  const getSubjectTag = (subject: Subject) => {
    const kindColors: Record<string, string> = {
      'User': 'blue',
      'Group': 'green',
      'ServiceAccount': 'purple'
    };

    const kindIcons: Record<string, React.ReactNode> = {
      'User': <Icons.team width={16} height={16} />,
      'Group': <Icons.team width={16} height={16} />,
      'ServiceAccount': <Icons.certificate width={16} height={16} />
    };

    return (
      <Tag
        color={kindColors[subject.kind] || 'default'}
        icon={kindIcons[subject.kind]}
        className="mb-1"
      >
        {subject.kind}: {subject.name}
        {subject.namespace && <span className="text-xs opacity-75"> ({subject.namespace})</span>}
      </Tag>
    );
  };

  const formatSubjects = (subjects?: Subject[]) => {
    if (!subjects || subjects.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    if (subjects.length <= 2) {
      return (
        <div className="flex flex-col gap-1">
          {subjects.map(subject => getSubjectTag(subject))}
        </div>
      );
    }

    return (
      <Tooltip title={
        <div className="flex flex-col gap-1">
          {subjects.map(subject => getSubjectTag(subject))}
        </div>
      }>
        <div className="flex flex-col gap-1">
          {subjects.slice(0, 2).map(subject => getSubjectTag(subject))}
          <Tag color="cyan">+{subjects.length - 2} more</Tag>
        </div>
      </Tooltip>
    );
  };

  const formatRoleRef = (roleRef?: RoleRef) => {
    if (!roleRef) {
      return <span className="text-gray-400">-</span>;
    }

    const kindColors: Record<string, string> = {
      'ClusterRole': 'orange',
      'Role': 'blue',
    };

    return (
      <Tag
        color={kindColors[roleRef.kind] || 'default'}
        icon={<Icons.certificate width={16} height={16} />}
      >
        {roleRef.name} ({roleRef.kind})
      </Tag>
    );
  };

  const formatLabels = (clusterRoleBinding: ClusterRoleBinding) => {
    const labels = clusterRoleBinding.objectMeta.labels || {};
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

  const columns: TableColumnProps<ClusterRoleBinding>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: ClusterRoleBinding) => (
        <strong>{record.objectMeta.name}</strong>
      ),
    },
    {
      title: 'Labels',
      dataIndex: 'labels',
      key: 'labels',
      render: (_: unknown, record: ClusterRoleBinding) => formatLabels(record),
    },
    {
      title: 'Role',
      dataIndex: 'roleRef',
      key: 'roleRef',
      render: (_: unknown, record: ClusterRoleBinding) => formatRoleRef(record.roleRef),
    },
    {
      title: 'Subjects',
      dataIndex: 'subjects',
      key: 'subjects',
      render: (_: unknown, record: ClusterRoleBinding) => formatSubjects(record.subjects),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_: string, record: ClusterRoleBinding) => {
        const create = dayjs(record.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ClusterRoleBinding) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View ClusterRoleBinding details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterClusterRoleBindingDetail({
                  memberClusterName,
                  name: record.objectMeta.name,
                });

                setViewDetail(detailResp as ClusterRoleBinding);
                setViewDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load ClusterRoleBinding');
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit ClusterRoleBinding"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName: memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                });
                if (ret.status !== 200) {
                  void messageApi.error(
                    'Failed to load ClusterRoleBinding',
                  );
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditDrawerOpen(true);
              } catch {
                void messageApi.error('Failed to load ClusterRoleBinding');
              }
            }}
          >
            Edit
          </Button>
          <Button
            icon={<Icons.delete width={16} height={16} />}
            danger
            title="Delete ClusterRoleBinding"
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
              `${range[0]}-${range[1]} of ${total} cluster role bindings`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="ClusterRoleBinding details"
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
              <div className="font-semibold mb-2">Role Reference</div>
              <div>Kind: {viewDetail.roleRef?.kind || '-'}</div>
              <div>Name: {viewDetail.roleRef?.name || '-'}</div>
              <div>API Group: {viewDetail.roleRef?.apiGroup || '-'}</div>
            </div>
            <div>
              <div className="font-semibold mb-2">Subjects</div>
              <div className="space-y-2">
                {viewDetail.subjects.map((subject, index) => (
                  <div key={index} className="border rounded p-2">
                    <div className="font-medium text-sm mb-1">Subject {index + 1}</div>
                    <div className="text-xs space-y-1">
                      <div>Kind: {subject.kind}</div>
                      <div>Name: {subject.name}</div>
                      {subject.namespace && <div>Namespace: {subject.namespace}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit ClusterRoleBinding (YAML)"
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
                      ret.message || 'Failed to update ClusterRoleBinding',
                    );
                    return;
                  }

                  setEditDrawerOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update ClusterRoleBinding');
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
