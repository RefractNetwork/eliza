// @ts-nocheck

import { useState } from "react";
import {
    useCurrentAccount,
    useSuiClient,
    useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "./ui/dialog";
import { apiClient } from "@/lib/api";
import { ModuleUploadData } from "@/types/marketplace";

interface UploadModuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const BAB_PACKAGE_ID = import.meta.env.VITE_BAB_PACKAGE_ID;
const BAB_NETWORK = import.meta.env.VITE_BAB_NETWORK;

export function UploadModuleDialog({
    isOpen,
    onClose,
    onSuccess,
}: UploadModuleDialogProps) {
    const [isUploading, setIsUploading] = useState(false);
    const client = useSuiClient();
    const account = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showObjectChanges: true,
                },
            }),
    });

    const [uploadData, setUploadData] = useState<ModuleUploadData>({
        name: "",
        type: "character",
        description: "",
        imageUrl: "",
        content: "",
    });

    const handleUpload = async () => {
        if (!account?.address) return;

        try {
            setIsUploading(true);

            console.log("Uploading module:", uploadData.content);
            // Only validate that it's valid JSON
            const cleanContent = uploadData.content.replace(/\n\s*/g, "");

            // Validate JSON
            try {
                JSON.parse(cleanContent);
                // Update the content with cleaned version
                uploadData.content = cleanContent;
            } catch (e) {
                throw new Error(
                    "Invalid JSON format. Please check your JSON syntax."
                );
            }

            const tx = new Transaction();
            tx.setGasBudget(20_000_000);
            tx.moveCall({
                target: `${BAB_PACKAGE_ID}::Core::publish_module`,
                arguments: [
                    tx.pure.string(uploadData.name),
                    tx.pure.string(uploadData.type),
                    tx.pure.string(uploadData.imageUrl),
                    tx.pure.string(uploadData.imageUrl), // Using same URL for thumbnail
                    tx.pure.string(uploadData.description),
                    tx.pure.string(account.address), // creator name
                ],
            });

            signAndExecuteTransaction(
                {
                    transaction: tx,
                    chain: `sui:${BAB_NETWORK}`,
                },
                {
                    onSuccess: async (result) => {
                        const createdModule = result.objectChanges?.find(
                            (change) =>
                                change.type === "created" &&
                                change.objectType.endsWith(
                                    "::Core::ComposableModule"
                                )
                        );

                        if (!createdModule) {
                            throw new Error(
                                "Failed to get created module data"
                            );
                        }

                        await apiClient.createModule({
                            moduleId: createdModule.objectId,
                            name: uploadData.name,
                            type: uploadData.type,
                            imageUrl: uploadData.imageUrl,
                            content: uploadData.content,
                            creatorId: account.address,
                            description: uploadData.description,
                        });

                        onSuccess();
                        onClose();
                    },
                    onError: (error) => {
                        console.error("Failed to create module:", error);
                        alert("Failed to create module: " + error.message);
                    },
                }
            );
        } catch (error) {
            console.error("Error uploading module:", error);
            alert((error as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    const JsonTextarea = ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (value: string) => void;
    }) => {
        const [error, setError] = useState<string | null>(null);

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = e.target.value;
            onChange(newValue);

            // Only check if it's valid JSON
            try {
                if (newValue.trim()) {
                    JSON.parse(newValue);
                    setError(null);
                }
            } catch (e) {
                setError("Invalid JSON format");
            }
        };

        return (
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                    Content (JSON)
                </label>
                <textarea
                    value={value}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 rounded-md bg-gray-800 border ${
                        error ? "border-red-500" : "border-gray-700"
                    } text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono`}
                    rows={10}
                    placeholder="Enter JSON content..."
                />
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogContent>
                <DialogHeader>
                    <h2 className="text-xl font-semibold text-white">
                        Upload Module
                    </h2>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            value={uploadData.name}
                            onChange={(e) =>
                                setUploadData((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                }))
                            }
                            className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Type
                        </label>
                        <select
                            value={uploadData.type}
                            onChange={(e) =>
                                setUploadData((prev) => ({
                                    ...prev,
                                    type: e.target
                                        .value as ModuleUploadData["type"],
                                }))
                            }
                            className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="character">Character</option>
                            <option value="knowledge">Knowledge</option>
                            <option value="speech">Speech</option>
                            {/* <option value="tone">Tone</option> */}
                            <option value="memory">Memory</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={uploadData.description}
                            onChange={(e) =>
                                setUploadData((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                            className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                            Image URL
                        </label>
                        <input
                            type="url"
                            value={uploadData.imageUrl}
                            onChange={(e) =>
                                setUploadData((prev) => ({
                                    ...prev,
                                    imageUrl: e.target.value,
                                }))
                            }
                            className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <JsonTextarea
                        value={uploadData.content}
                        onChange={(value) =>
                            setUploadData((prev) => ({
                                ...prev,
                                content: value,
                            }))
                        }
                    />

                    <DialogFooter>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? "Uploading..." : "Upload"}
                        </button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
