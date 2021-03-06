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
 *   Broadcom, Inc. - initial API and implementation
 */

import {IProfile} from "@zowe/imperative";
import * as path from "path";
import * as vscode from "vscode";
import {Disposable} from "vscode-languageclient";
import {COBOL_CBL_EXT, COBOL_COB_EXT, COBOL_COBOL_EXT, SETTINGS_CPY_SECTION} from "../constants";
import {ProfilesMap, ZoweApi} from "./ZoweApi";

const DEFAULT_STATUS_TEXT = "CPY profile: undefined";

export class ProfileService implements Disposable {

    private static isCobolProgram(fsPath: string) {
        const ext = path.extname(fsPath).toLocaleUpperCase();
        return [COBOL_CBL_EXT, COBOL_COB_EXT, COBOL_COBOL_EXT].includes(ext);
    }

    defaultProfileStatusBarItem: vscode.StatusBarItem;

    constructor(private zoweApi: ZoweApi) {
        this.createStatusBarItem();
    }

    public async getProfileFromMultiple(profiles?: ProfilesMap): Promise<string | undefined> {
        const defaultName = this.zoweApi.getDefaultProfileName();
        const auxProfiles: ProfilesMap = profiles ? profiles : await this.zoweApi.listZOSMFProfiles();
        let items: vscode.QuickPickItem[] = [];
        Object.keys(auxProfiles).forEach(name => {
            const profile: IProfile = auxProfiles[name];
            const item: vscode.QuickPickItem = {
                description: profile.user + "@" + profile.host + ":" + profile.port,
                label: name,
            };
            if (defaultName === name) {
                items = [item].concat(items);
            } else {
                items.push(item);
            }
        });

        const selectedProfile = await vscode.window.showQuickPick(items,
            {placeHolder: "Select a zowe profile to search for copybooks", canPickMany: false});
        if (selectedProfile) {
            // TODO Switch to program specific profiles
            await vscode.workspace.getConfiguration(SETTINGS_CPY_SECTION).update("profiles",
                selectedProfile.label, false);
            return selectedProfile.label;
        }
        return undefined;
    }

    public async getProfileFromSettings(profiles?: ProfilesMap): Promise<string | undefined> {
        const auxProfiles: ProfilesMap = profiles ? profiles : await this.zoweApi.listZOSMFProfiles();
        return this.tryGetProfileFromSettings(auxProfiles);
    }

    async updateStatusBar() {
        const profiles: ProfilesMap = await this.zoweApi.listZOSMFProfiles();
        const profile: string | undefined = this.tryGetProfileFromSettings(profiles);
        if (profile) {
            this.defaultProfileStatusBarItem.text = `CPY profile: ${profile}`;
        } else {
            this.defaultProfileStatusBarItem.text = DEFAULT_STATUS_TEXT;
        }
    }

    dispose(): void {
        this.defaultProfileStatusBarItem.dispose();
    }

    public async resolveProfile(programName: string) {
        const profile: string = await this.getProfileFromSettings();
        return (profile) ? profile : await this.getProfileFromDocument(programName);

    }

    /**
     * This async method verify that a profile is selected by the user and could be used to resolve
     * resources on MF
     * @param programName name of the COBOL program opened into the workspace
     * @return a string representation of the profile selected or undefined
     */
    public async getProfileFromDocument(programName: string): Promise<string | undefined> {
        for (const doc of vscode.workspace.textDocuments) {
            const docPath = doc.fileName;
            if (!ProfileService.isCobolProgram(docPath)) {
                continue;
            }
            const openName = path.basename(docPath);
            if (programName === openName) {
                const profile = await this.tryGetProfileFromDocumentPath(docPath);
                if (profile) {
                    return profile;
                }
            }
        }
        return undefined;
    }

    private createStatusBarItem() {
        this.defaultProfileStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.defaultProfileStatusBarItem.command = "cobol-lsp.cpy-manager.change-default-zowe-profile";
        this.updateStatusBar();
        this.defaultProfileStatusBarItem.show();
    }

    private tryGetProfileFromSettings(profiles: ProfilesMap): string | undefined {
        // TODO switch from single profile to program specific profile
        const profile: string = vscode.workspace.getConfiguration(SETTINGS_CPY_SECTION).get("profiles");

        if (profiles[profile]) {
            return profile;
        }

        return undefined;
    }

    private async tryGetProfileFromDocumentPath(docPath: string): Promise<string | undefined> {
        const profiles = Object.keys(await this.zoweApi.listZOSMFProfiles());
        const segments: string[] = docPath.split(path.sep);
        if (segments.length < 2) {
            return undefined;
        }
        const profileName = segments[segments.length - 2];
        if (profiles.indexOf(profileName) >= 0) {
            return profileName;
        }
        return undefined;
    }
}
