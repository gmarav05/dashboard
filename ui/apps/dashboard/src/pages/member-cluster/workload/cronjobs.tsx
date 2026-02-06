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

import { App, Button, Drawer, Input, Select, Space, Table, TableColumnProps } from 'antd';
import { Icons } from '@/components/icons';
import { useMemberClusterContext, useMemberClusterNamespace } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { WorkloadKind } from '@/services/base';
import { useState } from 'react';
import {
  GetMemberClusterWorkloadDetail,
  GetMemberClusterWorkloadEvents,
  GetMemberClusterCronJobs,
  Workload,
  WorkloadDetail,
  WorkloadEvent,
} from '@/services/member-cluster/workload';
import i18nInstance from '@/utils/i18n';
import dayjs from 'dayjs';
import { stringify, parse } from 'yaml';
import Editor from '@monaco-editor/react';
import { GetResource, PutResource } from '@/services/member-cluster/unstructured';

export default function MemberClusterCronJobs() {
  const { message: messageApi } = App.useApp();
  const { memberClusterName } = useMemberClusterContext();
  const [filter, setFilter] = useState<{
    kind: WorkloadKind;
    selectedWorkSpace: string;
    searchText: string;
  }>({
    kind: WorkloadKind.Cronjob,
    selectedWorkSpace: '',
    searchText: '',
  });
  const { nsOptions, isNsDataLoading } = useMemberClusterNamespace({ memberClusterName });
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<WorkloadDetail | null>(null);
  const [viewEvents, setViewEvents] = useState<WorkloadEvent[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['GetCronJobs', memberClusterName, filter],
    queryFn: async () => {
      const workloads = await GetMemberClusterCronJobs({
        memberClusterName,
        namespace: filter.selectedWorkSpace,
        keyword: filter.searchText,
      });
      return workloads;
    },
  });

  const columns: TableColumnProps<Workload>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_name: string, record: Workload) => (
        <>{record.objectMeta.name}</>
      ),
    },
    {
      title: 'Namespace',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (_name: string, record: Workload) => (
        <>{record.objectMeta.namespace}</>
      ),
    },
    {
      title: 'Ready',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (_status: string, record: Workload) => (
        <>
          {record.pods?.running}/{record.pods?.desired}
        </>
      ),
    },
    {
      title: 'Images',
      dataIndex: 'images',
      key: 'images',
      render: (_, record: Workload) => (
        <code className="text-xs">{record.containerImages?.[0]}</code>
      ),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      render: (_, r) => {
        const create = dayjs(r.objectMeta.creationTimestamp);
        return create.fromNow();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Workload) => (
        <Space>
          <Button
            icon={<Icons.eye width={16} height={16} />}
            title="View details"
            onClick={async () => {
              setViewLoading(true);
              try {
                const detailResp = await GetMemberClusterWorkloadDetail({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                  kind: WorkloadKind.Cronjob,
                });
                const eventsResp = await GetMemberClusterWorkloadEvents({
                  memberClusterName,
                  namespace: record.objectMeta.namespace,
                  name: record.objectMeta.name,
                  kind: WorkloadKind.Cronjob,
                });


                setViewDetail((detailResp?.data ?? ({} as any)) as WorkloadDetail);
                setViewEvents(eventsResp?.data?.events || []);
                setViewDrawerOpen(true);
              } finally {
                setViewLoading(false);
              }
            }}
          >
            View
          </Button>
          <Button
            icon={<Icons.edit width={16} height={16} />}
            title="Edit CronJob"
            onClick={async () => {
              try {
                const ret = await GetResource({
                  memberClusterName,
                  kind: record.typeMeta.kind,
                  name: record.objectMeta.name,
                  namespace: record.objectMeta.namespace,
                });

                if (ret.status !== 200) {
                  void messageApi.error('Failed to load CronJob');
                  return;
                }

                setEditContent(stringify(ret.data));
                setEditModalOpen(true);
              } catch {
                void messageApi.error('Failed to load CronJob');
              }
            }}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className={'flex flex-row space-x-4 mb-4'}>
        <h3 className={'leading-[32px]'}>
          {i18nInstance.t('280c56077360c204e536eb770495bc5f', '命名空间')}：
        </h3>
        <Select
          options={nsOptions}
          className={'min-w-[200px]'}
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
          placeholder={i18nInstance.t(
            'cfaff3e369b9bd51504feb59bf0972a0',
            '按命名空间搜索',
          )}
          className={'w-[300px]'}
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
          rowKey={(record) =>
            `${record.objectMeta.namespace}-${record.objectMeta.name}`
          }
          columns={columns}
          dataSource={data?.data?.cronJobs || []}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} cronjobs`,
          }}
          loading={isLoading}
        />
      </div>

      <Drawer
        title="CronJob details"
        placement="right"
        width={800}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewDetail(null);
          setViewEvents([]);
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
              <div>
                Created:{' '}
                {viewDetail.objectMeta?.creationTimestamp
                  ? dayjs(viewDetail.objectMeta.creationTimestamp).format(
                    'YYYY-MM-DD HH:mm:ss',
                  )
                  : '-'}
              </div>
              <div>
                Images:{' '}
                <code className="text-xs">
                  {viewDetail.containerImages?.join(', ')}
                </code>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Pods</div>
              <div>
                Running: {viewDetail.pods?.running} / Desired:{' '}
                {viewDetail.pods?.desired}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Events</div>
              <div className="space-y-1 max-h-64 overflow-auto text-xs">
                {viewEvents.map((e) => (
                  <div key={e.objectMeta.uid} className="border-b pb-1">
                    <div>
                      [{e.type}] {e.reason}
                    </div>
                    <div>{e.message}</div>
                    <div className="text-gray-500">
                      {e.sourceComponent} · {e.lastSeen}
                    </div>
                  </div>
                ))}
                {!viewEvents.length && <div>No events</div>}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title="Edit CronJob (YAML)"
        placement="right"
        width={900}
        open={editModalOpen}
        onClose={() => {
          if (!editSubmitting) {
            setEditModalOpen(false);
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
                    memberClusterName,
                    kind,
                    name,
                    namespace,
                    content: yamlObject,
                  });

                  if (ret.code !== 200) {
                    void messageApi.error(
                      ret.message || 'Failed to update CronJob',
                    );
                    return;
                  }

                  setEditModalOpen(false);
                  setEditContent('');
                } catch {
                  void messageApi.error('Failed to update CronJob');
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
