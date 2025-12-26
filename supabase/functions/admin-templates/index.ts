/**
 * Admin Templates API
 * Full CRUD operations for workflow templates (Admin only)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TemplateInput {
  name: string;
  description?: string;
  category: string;
  nodes: unknown;
  edges: unknown;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  estimated_setup_time?: number;
  tags?: string[];
  is_featured?: boolean;
  preview_image?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    
    // Verify user and get user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const path = new URL(req.url).pathname;
    const method = req.method;

    // Route handling
    if (method === 'GET' && path.endsWith('/admin-templates')) {
      // List all templates (admin can see inactive too)
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ templates: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'GET' && path.includes('/admin-templates/')) {
      // Get single template
      const templateId = path.split('/').pop();
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ template: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST' && path.endsWith('/admin-templates')) {
      // Create new template
      const body: TemplateInput = await req.json();

      const { data, error } = await supabase
        .from('templates')
        .insert({
          name: body.name,
          description: body.description,
          category: body.category,
          nodes: body.nodes,
          edges: body.edges,
          difficulty: body.difficulty || 'Beginner',
          estimated_setup_time: body.estimated_setup_time || 5,
          tags: body.tags || [],
          is_featured: body.is_featured || false,
          preview_image: body.preview_image,
          created_by: user.id,
          version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ template: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'PUT' && path.includes('/admin-templates/')) {
      // Update template (version auto-increments)
      const templateId = path.split('/').pop();
      const body: Partial<TemplateInput> = await req.json();

      const { data, error } = await supabase
        .from('templates')
        .update({
          name: body.name,
          description: body.description,
          category: body.category,
          nodes: body.nodes,
          edges: body.edges,
          difficulty: body.difficulty,
          estimated_setup_time: body.estimated_setup_time,
          tags: body.tags,
          is_featured: body.is_featured,
          preview_image: body.preview_image,
          updated_by: user.id,
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ template: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'PATCH' && path.includes('/admin-templates/')) {
      // Partial update (e.g., toggle is_active)
      const templateId = path.split('/').pop();
      const body: Partial<TemplateInput & { is_active?: boolean }> = await req.json();

      const { data, error } = await supabase
        .from('templates')
        .update({
          ...(body.is_active !== undefined && { is_active: body.is_active }),
          ...(body.is_featured !== undefined && { is_featured: body.is_featured }),
          updated_by: user.id,
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ template: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'DELETE' && path.includes('/admin-templates/')) {
      // Delete template (soft delete by setting is_active = false)
      const templateId = path.split('/').pop();

      // Check if any workflows are using this template
      const { count } = await supabase
        .from('workflows')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);

      if (count && count > 0) {
        // Soft delete instead of hard delete
        const { data, error } = await supabase
          .from('templates')
          .update({ is_active: false, updated_by: user.id })
          .eq('id', templateId)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            template: data,
            message: 'Template deactivated (workflows are using it)'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hard delete if no workflows are using it
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Template deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin templates API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

