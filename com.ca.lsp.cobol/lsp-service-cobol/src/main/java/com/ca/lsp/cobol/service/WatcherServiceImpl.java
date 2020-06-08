/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *    Broadcom, Inc. - initial API and implementation
 *
 */

package com.ca.lsp.cobol.service;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import lombok.Synchronized;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.services.LanguageClient;

import javax.annotation.Nonnull;
import java.util.ArrayList;
import java.util.List;

import static java.util.Collections.singletonList;
import static java.util.Collections.unmodifiableList;
import static java.util.stream.Collectors.toList;

/**
 * This class creates watchers with type to watch all types of events. The key to remove a watcher
 * is its path without any changes.
 */
@Singleton
public class WatcherServiceImpl implements WatcherService {

  /**
   * The kind of events of interest, for watchers calculated as WatchKind.Create | WatchKind.Change
   * | WatchKind.Delete which is 7
   */
  private static final int WATCH_ALL_KIND = 7;

  /** Glob patterns to watch the copybooks folder and copybook files */
  private static final String COPYBOOKS_FOLDER_GLOB = "**/.copybooks/**/*";

  private static final String WATCH_FILES = "workspace/didChangeWatchedFiles";
  private static final String WATCH_CONFIGURATION = "workspace/didChangeConfiguration";
  private static final String CONFIGURATION_CHANGE_ID = "configurationChange";
  private static final String PREDEFINED_FOLDER_WATCHER = "copybooksWatcher";

  private final List<String> folderWatchers = new ArrayList<>();

  private final Provider<LanguageClient> clientProvider;

  @Inject
  WatcherServiceImpl(Provider<LanguageClient> clientProvider) {
    this.clientProvider = clientProvider;
  }

  @Nonnull
  public List<String> getWatchingFolders() {
    return unmodifiableList(folderWatchers);
  }

  @Override
  public void watchConfigurationChange() {
    register(singletonList(new Registration(CONFIGURATION_CHANGE_ID, WATCH_CONFIGURATION, null)));
  }

  @Override
  public void watchPredefinedFolder() {
    register(
        singletonList(
            new Registration(
                PREDEFINED_FOLDER_WATCHER,
                WATCH_FILES,
                new DidChangeWatchedFilesRegistrationOptions(
                    singletonList(new FileSystemWatcher(COPYBOOKS_FOLDER_GLOB, WATCH_ALL_KIND))))));
  }

  @Override
  @Synchronized
  public void addWatchers(@Nonnull List<String> paths) {
    register(
        paths.stream()
            .map(
                it -> {
                  folderWatchers.add(it);
                  return new Registration(
                      it,
                      WATCH_FILES,
                      new DidChangeWatchedFilesRegistrationOptions(
                          singletonList(new FileSystemWatcher(toGlobPattern(it), WATCH_ALL_KIND))));
                })
            .collect(toList()));
  }

  @Override
  @Synchronized
  public void removeWatchers(@Nonnull List<String> paths) {
    List<String> removedWatchers = paths.stream().filter(folderWatchers::remove).collect(toList());
    if (!removedWatchers.isEmpty()) {
      clientProvider
          .get()
          .unregisterCapability(
              new UnregistrationParams(
                  removedWatchers.stream()
                      .map(it -> new Unregistration(it, WATCH_FILES))
                      .collect(toList())));
    }
  }

  private String toGlobPattern(String it) {
    return "**/" + it + "/**/*";
  }

  private void register(List<Registration> registrations) {
    clientProvider.get().registerCapability(new RegistrationParams(registrations));
  }
}
