'use client';
import FormEditor from '../_components/FormEditor';

export default function NewFormPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">New Form</h1>
        <p className="text-muted-foreground">Create a form to collect submissions from your visitors.</p>
      </div>
      <FormEditor />
    </div>
  );
}
