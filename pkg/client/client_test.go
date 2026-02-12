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

package client

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRestConfigFromKubeConfig(t *testing.T) {
	validKubeconfig := `
apiVersion: v1
clusters:
- cluster:
    server: https://localhost:6443
  name: test
contexts:
- context:
    cluster: test
    user: test
  name: test
current-context: test
kind: Config
preferences: {}
users:
- name: test
  user:
    token: test-token
`
	testCases := []struct {
		name        string
		kubeconfig  string
		expectError bool
	}{
		{
			name:        "valid kubeconfig",
			kubeconfig:  validKubeconfig,
			expectError: false,
		},
		{
			name:        "invalid kubeconfig",
			kubeconfig:  "invalid content",
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := LoadRestConfigFromKubeConfig(tc.kubeconfig)
			if (err != nil) != tc.expectError {
				t.Errorf("LoadRestConfigFromKubeConfig() error = %v, expectError %v", err, tc.expectError)
			}
		})
	}
}

func TestLoadAPIConfig(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "kubeconfig-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	kubeconfigPath := filepath.Join(tempDir, "config")
	kubeconfigContent := `
apiVersion: v1
clusters:
- cluster:
    server: https://localhost:6443
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test-context
current-context: test-context
kind: Config
users:
- name: test-user
  user:
    token: secret
`
	if err := os.WriteFile(kubeconfigPath, []byte(kubeconfigContent), 0600); err != nil {
		t.Fatal(err)
	}

	testCases := []struct {
		name            string
		context         string
		expectError     bool
		expectedContext string
	}{
		{
			name:            "valid context",
			context:         "test-context",
			expectError:     false,
			expectedContext: "test-context",
		},
		{
			name:            "empty context (uses current)",
			context:         "",
			expectError:     false,
			expectedContext: "test-context",
		},
		{
			name:        "non-existent context",
			context:     "non-existent",
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			config, err := LoadAPIConfig(kubeconfigPath, tc.context)
			if (err != nil) != tc.expectError {
				t.Errorf("LoadAPIConfig() error = %v, expectError %v", err, tc.expectError)
				return
			}
			if !tc.expectError {
				if config.CurrentContext != tc.expectedContext {
					t.Errorf("expected context %s, got %s", tc.expectedContext, config.CurrentContext)
				}
			}
		})
	}
}
