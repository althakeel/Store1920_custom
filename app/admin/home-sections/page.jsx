'use client'
import { useState, useEffect } from "react";
import axios from "axios";
import { PlusIcon, TrashIcon, EditIcon } from "lucide-react";
import PageTitle from "@/components/PageTitle";
import Link from "next/link";


export default function HomeSectionsPage() {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = async () => {
        try {
            const { data } = await axios.get('/api/admin/home-sections');
            setSections(data.sections || []);
        } catch (error) {
            console.error('Error fetching sections:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this section?')) return;
        try {
            await axios.delete(`/api/admin/home-sections/${id}`);
            fetchSections();
        } catch (error) {
            console.error('Error deleting section:', error);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <PageTitle title="Home Page Sections" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Manage Home Sections</h1>
                <Link href="/admin/home-sections/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition">
                    <PlusIcon size={20} />
                    Add Section
                </Link>
            </div>

            {/* Sections List */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slides</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sections.map((section) => (
                            <tr key={section._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{section.title || section.section}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.sectionType === 'hero_categories' ? 'Hero Categories Slider' : section.sectionType === 'category' ? 'By Category' : 'Manual'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.category || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.tag || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.productIds?.length || 0} products</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.slides?.length || 0}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{section.isActive ? 'Yes' : 'No'}</td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Link href={`/admin/home-sections/${section._id}`} className="text-blue-600 hover:text-blue-700">
                                            <EditIcon size={18} />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(section._id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <TrashIcon size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
