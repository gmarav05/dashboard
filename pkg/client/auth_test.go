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
	"net/http/httptest"
	"reflect"
	"testing"

	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

func TestHasAuthorizationHeader(t *testing.T) {
	testCases := []struct {
		name     string
		header   string
		expected bool
	}{
		{
			name:     "Valid Bearer token",
			header:   "Bearer my-token",
			expected: true,
		},
		{
			name:     "Missing Bearer prefix",
			header:   "my-token",
			expected: false,
		},
		{
			name:     "Empty header",
			header:   "",
			expected: false,
		},
		{
			name:     "Bearer prefix only",
			header:   "Bearer ",
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tc.header != "" {
				req.Header.Set(authorizationHeader, tc.header)
			}
			result := HasAuthorizationHeader(req)
			if result != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, result)
			}
		})
	}
}

func TestGetBearerToken(t *testing.T) {
	testCases := []struct {
		name        string
		headerValue string
		expected    string
	}{
		{
			name:        "Valid Bearer token",
			headerValue: "Bearer my-secret-token",
			expected:    "my-secret-token",
		},
		{
			name:        "Missing Bearer prefix",
			headerValue: "my-secret-token",
			expected:    "my-secret-token", // extractBearerToken just trims prefix
		},
		{
			name:        "Empty header",
			headerValue: "",
			expected:    "",
		},
		{
			name:        "Bearer prefix only",
			headerValue: "Bearer ",
			expected:    "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tc.headerValue != "" {
				req.Header.Set(authorizationHeader, tc.headerValue)
			}
			result := GetBearerToken(req)
			if result != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, result)
			}
		})
	}
}

func TestHandleImpersonation(t *testing.T) {
	testCases := []struct {
		name     string
		headers  map[string][]string
		expected *clientcmdapi.AuthInfo
	}{
		{
			name: "User impersonation",
			headers: map[string][]string{
				ImpersonateUserHeader: {"user1"},
			},
			expected: &clientcmdapi.AuthInfo{
				Impersonate:          "user1",
				ImpersonateUserExtra: make(map[string][]string),
			},
		},
		{
			name: "User and groups impersonation",
			headers: map[string][]string{
				ImpersonateUserHeader:  {"user1"},
				ImpersonateGroupHeader: {"group1", "group2"},
			},
			expected: &clientcmdapi.AuthInfo{
				Impersonate:          "user1",
				ImpersonateGroups:    []string{"group1", "group2"},
				ImpersonateUserExtra: make(map[string][]string),
			},
		},
		{
			name: "User and extra impersonation",
			headers: map[string][]string{
				ImpersonateUserHeader:               {"user1"},
				ImpersonateUserExtraHeader + "key1": {"val1", "val2"},
			},
			expected: &clientcmdapi.AuthInfo{
				Impersonate: "user1",
				ImpersonateUserExtra: map[string][]string{
					"key1": {"val1", "val2"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			for k, v := range tc.headers {
				req.Header[k] = v
			}

			authInfo := &clientcmdapi.AuthInfo{
				ImpersonateUserExtra: make(map[string][]string),
			}
			handleImpersonation(authInfo, req)

			if !reflect.DeepEqual(authInfo, tc.expected) {
				t.Errorf("expected %+v, got %+v", tc.expected, authInfo)
			}
		})
	}
}
