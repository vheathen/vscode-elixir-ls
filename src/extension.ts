"use strict";

import * as vscode from "vscode";

import { TaskProvider } from "./taskProvider";
import { configureDebugger } from "./debugAdapter";
import { configureTerminalLinkProvider } from "./terminalLinkProvider";
import { configureTestController } from "./testController";
import { LanguageClientManager } from "./languageClientManager";
import { detectConflictingExtensions } from "./conflictingExtensions";
import { configureCommands } from "./commands";
import { WorkspaceTracker } from "./project";
import { configureTelemetry, reporter } from "./telemetry";
import { testElixir } from "./testElixir";

console.log("ElixirLS: Loading extension");

export interface ElixirLS {
  workspaceTracker: WorkspaceTracker;
  languageClientManager: LanguageClientManager;
}

export const workspaceTracker = new WorkspaceTracker();
export const languageClientManager = new LanguageClientManager(
  workspaceTracker
);

const startClientsForOpenDocuments = (context: vscode.ExtensionContext) => {
  vscode.workspace.textDocuments.forEach((value) => {
    languageClientManager.handleDidOpenTextDocument(value, context);
  });
};

export function activate(context: vscode.ExtensionContext): ElixirLS {
  console.log(`ElixirLS: activating extension in mode`, workspaceTracker.mode);
  console.log(
    "ElixirLS: Workspace folders are",
    vscode.workspace.workspaceFolders
  );
  console.log(
    "ElixirLS: Workspace is",
    vscode.workspace.workspaceFile?.toString()
  );

  configureTelemetry(context);

  reporter.sendTelemetryEvent(
    "elixir_ls.extension_activated",
    {"elixir_ls.workspace_mode": workspaceTracker.mode}
  );

  // TODO remove
  setTimeout(() => {
		throw new Error("HELLO WORLD");
	}, 5000);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      console.info(
        "ElixirLS: Workspace folders changed",
        vscode.workspace.workspaceFolders
      );
      workspaceTracker.handleDidChangeWorkspaceFolders();
    })
  );

  testElixir();

  detectConflictingExtensions();

  configureCommands(context, languageClientManager);
  configureDebugger(context);
  configureTerminalLinkProvider(context);
  configureTestController(context, languageClientManager, workspaceTracker);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((value) => {
      languageClientManager.handleDidOpenTextDocument(value, context);
    })
  );

  startClientsForOpenDocuments(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.removed) {
        await languageClientManager.handleWorkspaceFolderRemoved(folder);
      }
      // we might have closed client for some nested workspace folder child
      // reopen all needed
      startClientsForOpenDocuments(context);
    })
  );

  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(TaskProvider.TaskType, new TaskProvider())
  );

  console.log(`ElixirLS: extension activated`);
  return {
    languageClientManager,
    workspaceTracker,
  };
}

export async function deactivate() {
  console.log(`ElixirLS: deactivating extension`);
  reporter.sendTelemetryEvent(
    "elixir_ls.extension_deactivated",
    {"elixir_ls.workspace_mode": workspaceTracker.mode}
  );
  workspaceTracker.handleDidChangeWorkspaceFolders();
  await languageClientManager.deactivate();
  console.log(`ElixirLS: extension deactivated`);
}
