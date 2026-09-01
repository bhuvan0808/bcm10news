export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      article_assignments: {
        Row: {
          accepted_at: string | null;
          article_id: string | null;
          assigned_by: string;
          assigned_to: string;
          brief: string;
          category_id: string | null;
          completed_at: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          location_id: string | null;
          priority: number;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          article_id?: string | null;
          assigned_by: string;
          assigned_to: string;
          brief: string;
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          location_id?: string | null;
          priority?: number;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          article_id?: string | null;
          assigned_by?: string;
          assigned_to?: string;
          brief?: string;
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          location_id?: string | null;
          priority?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_assignments_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_assignments_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      article_coauthors: {
        Row: {
          article_id: string;
          position: number;
          profile_id: string;
        };
        Insert: {
          article_id: string;
          position?: number;
          profile_id: string;
        };
        Update: {
          article_id?: string;
          position?: number;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_coauthors_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_coauthors_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_coauthors_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_coauthors_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_media: {
        Row: {
          article_id: string;
          caption: string | null;
          caption_te: string | null;
          created_at: string;
          id: string;
          media_id: string;
          position: number;
          role: string;
        };
        Insert: {
          article_id: string;
          caption?: string | null;
          caption_te?: string | null;
          created_at?: string;
          id?: string;
          media_id: string;
          position?: number;
          role?: string;
        };
        Update: {
          article_id?: string;
          caption?: string | null;
          caption_te?: string | null;
          created_at?: string;
          id?: string;
          media_id?: string;
          position?: number;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_media_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_media_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_media_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      article_related: {
        Row: {
          article_id: string;
          created_at: string;
          position: number;
          related_article_id: string;
        };
        Insert: {
          article_id: string;
          created_at?: string;
          position?: number;
          related_article_id: string;
        };
        Update: {
          article_id?: string;
          created_at?: string;
          position?: number;
          related_article_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_related_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_related_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_related_related_article_id_fkey';
            columns: ['related_article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_related_related_article_id_fkey';
            columns: ['related_article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_revisions: {
        Row: {
          article_id: string;
          body: Json;
          body_text: string;
          change_summary: string | null;
          created_at: string;
          created_by: string | null;
          excerpt: string | null;
          id: string;
          is_published_version: boolean;
          status: Database['public']['Enums']['article_status'];
          subtitle: string | null;
          title: string;
          title_te: string | null;
          version: number;
        };
        Insert: {
          article_id: string;
          body: Json;
          body_text?: string;
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          excerpt?: string | null;
          id?: string;
          is_published_version?: boolean;
          status: Database['public']['Enums']['article_status'];
          subtitle?: string | null;
          title: string;
          title_te?: string | null;
          version: number;
        };
        Update: {
          article_id?: string;
          body?: Json;
          body_text?: string;
          change_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          excerpt?: string | null;
          id?: string;
          is_published_version?: boolean;
          status?: Database['public']['Enums']['article_status'];
          subtitle?: string | null;
          title?: string;
          title_te?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'article_revisions_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_revisions_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_revisions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_slug_history: {
        Row: {
          article_id: string;
          created_at: string;
          slug: string;
        };
        Insert: {
          article_id: string;
          created_at?: string;
          slug: string;
        };
        Update: {
          article_id?: string;
          created_at?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_slug_history_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_slug_history_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_status_history: {
        Row: {
          action: Database['public']['Enums']['review_action'] | null;
          actor_id: string | null;
          article_id: string;
          created_at: string;
          from_status: Database['public']['Enums']['article_status'] | null;
          id: string;
          note: string | null;
          to_status: Database['public']['Enums']['article_status'];
        };
        Insert: {
          action?: Database['public']['Enums']['review_action'] | null;
          actor_id?: string | null;
          article_id: string;
          created_at?: string;
          from_status?: Database['public']['Enums']['article_status'] | null;
          id?: string;
          note?: string | null;
          to_status: Database['public']['Enums']['article_status'];
        };
        Update: {
          action?: Database['public']['Enums']['review_action'] | null;
          actor_id?: string | null;
          article_id?: string;
          created_at?: string;
          from_status?: Database['public']['Enums']['article_status'] | null;
          id?: string;
          note?: string | null;
          to_status?: Database['public']['Enums']['article_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'article_status_history_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_status_history_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_status_history_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_status_history_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_tags: {
        Row: {
          article_id: string;
          position: number;
          tag_id: string;
        };
        Insert: {
          article_id: string;
          position?: number;
          tag_id: string;
        };
        Update: {
          article_id?: string;
          position?: number;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_tags_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_tags_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      article_videos: {
        Row: {
          article_id: string;
          caption: string | null;
          caption_te: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          is_short: boolean;
          original_url: string;
          position: number;
          provider: Database['public']['Enums']['video_provider'];
          thumbnail_url: string | null;
          title: string | null;
          updated_at: string;
          video_id: string;
        };
        Insert: {
          article_id: string;
          caption?: string | null;
          caption_te?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          is_short?: boolean;
          original_url: string;
          position?: number;
          provider?: Database['public']['Enums']['video_provider'];
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          video_id: string;
        };
        Update: {
          article_id?: string;
          caption?: string | null;
          caption_te?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          is_short?: boolean;
          original_url?: string;
          position?: number;
          provider?: Database['public']['Enums']['video_provider'];
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'article_videos_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_videos_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
      article_views: {
        Row: {
          article_id: string;
          country: string | null;
          device_kind: string | null;
          id: number;
          profile_id: string | null;
          read_depth: number | null;
          referrer_host: string | null;
          viewed_at: string;
          visitor_hash: string | null;
        };
        Insert: {
          article_id: string;
          country?: string | null;
          device_kind?: string | null;
          id?: number;
          profile_id?: string | null;
          read_depth?: number | null;
          referrer_host?: string | null;
          viewed_at?: string;
          visitor_hash?: string | null;
        };
        Update: {
          article_id?: string;
          country?: string | null;
          device_kind?: string | null;
          id?: number;
          profile_id?: string | null;
          read_depth?: number | null;
          referrer_host?: string | null;
          viewed_at?: string;
          visitor_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'article_views_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_views_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_views_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_views_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      articles: {
        Row: {
          allow_comments: boolean;
          allow_syndication: boolean;
          author_id: string;
          body: Json;
          body_text: string;
          byline_override: string | null;
          canonical_url: string | null;
          category_id: string;
          comment_count: number;
          created_at: string;
          editor_id: string | null;
          excerpt: string | null;
          featured_image_id: string | null;
          featured_video_id: string | null;
          first_published_at: string | null;
          id: string;
          is_breaking: boolean;
          is_exclusive: boolean;
          is_featured: boolean;
          is_premium: boolean;
          is_sponsored: boolean;
          language: Database['public']['Enums']['content_language'];
          location_id: string | null;
          noindex: boolean;
          og_image_id: string | null;
          preview_paragraphs: number;
          priority: number;
          published_at: string | null;
          reading_time_minutes: number;
          scheduled_for: string | null;
          search_vector: unknown;
          secondary_category_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          share_count: number;
          slug: string;
          status: Database['public']['Enums']['article_status'];
          subtitle: string | null;
          title: string;
          title_te: string | null;
          unpublished_at: string | null;
          updated_at: string;
          view_count: number;
          word_count: number;
        };
        Insert: {
          allow_comments?: boolean;
          allow_syndication?: boolean;
          author_id: string;
          body?: Json;
          body_text?: string;
          byline_override?: string | null;
          canonical_url?: string | null;
          category_id: string;
          comment_count?: number;
          created_at?: string;
          editor_id?: string | null;
          excerpt?: string | null;
          featured_image_id?: string | null;
          featured_video_id?: string | null;
          first_published_at?: string | null;
          id?: string;
          is_breaking?: boolean;
          is_exclusive?: boolean;
          is_featured?: boolean;
          is_premium?: boolean;
          is_sponsored?: boolean;
          language?: Database['public']['Enums']['content_language'];
          location_id?: string | null;
          noindex?: boolean;
          og_image_id?: string | null;
          preview_paragraphs?: number;
          priority?: number;
          published_at?: string | null;
          reading_time_minutes?: number;
          scheduled_for?: string | null;
          search_vector?: unknown;
          secondary_category_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          share_count?: number;
          slug: string;
          status?: Database['public']['Enums']['article_status'];
          subtitle?: string | null;
          title: string;
          title_te?: string | null;
          unpublished_at?: string | null;
          updated_at?: string;
          view_count?: number;
          word_count?: number;
        };
        Update: {
          allow_comments?: boolean;
          allow_syndication?: boolean;
          author_id?: string;
          body?: Json;
          body_text?: string;
          byline_override?: string | null;
          canonical_url?: string | null;
          category_id?: string;
          comment_count?: number;
          created_at?: string;
          editor_id?: string | null;
          excerpt?: string | null;
          featured_image_id?: string | null;
          featured_video_id?: string | null;
          first_published_at?: string | null;
          id?: string;
          is_breaking?: boolean;
          is_exclusive?: boolean;
          is_featured?: boolean;
          is_premium?: boolean;
          is_sponsored?: boolean;
          language?: Database['public']['Enums']['content_language'];
          location_id?: string | null;
          noindex?: boolean;
          og_image_id?: string | null;
          preview_paragraphs?: number;
          priority?: number;
          published_at?: string | null;
          reading_time_minutes?: number;
          scheduled_for?: string | null;
          search_vector?: unknown;
          secondary_category_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          share_count?: number;
          slug?: string;
          status?: Database['public']['Enums']['article_status'];
          subtitle?: string | null;
          title?: string;
          title_te?: string | null;
          unpublished_at?: string | null;
          updated_at?: string;
          view_count?: number;
          word_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'articles_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_editor_id_fkey';
            columns: ['editor_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_editor_id_fkey';
            columns: ['editor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_featured_image_id_fkey';
            columns: ['featured_image_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_featured_video_fk';
            columns: ['featured_video_id'];
            isOneToOne: false;
            referencedRelation: 'article_videos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_og_image_id_fkey';
            columns: ['og_image_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_secondary_category_id_fkey';
            columns: ['secondary_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          actor_role: Database['public']['Enums']['user_role'] | null;
          created_at: string;
          id: number;
          ip_address: unknown;
          metadata: Json;
          request_id: string | null;
          resource_id: string | null;
          resource_type: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_role?: Database['public']['Enums']['user_role'] | null;
          created_at?: string;
          id?: number;
          ip_address?: unknown;
          metadata?: Json;
          request_id?: string | null;
          resource_id?: string | null;
          resource_type: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          actor_role?: Database['public']['Enums']['user_role'] | null;
          created_at?: string;
          id?: number;
          ip_address?: unknown;
          metadata?: Json;
          request_id?: string | null;
          resource_id?: string | null;
          resource_type?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean;
          name: string;
          name_te: string | null;
          parent_id: string | null;
          position: number;
          seo_description: string | null;
          seo_title: string | null;
          show_in_nav: boolean;
          show_on_homepage: boolean;
          slug: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          name_te?: string | null;
          parent_id?: string | null;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          show_in_nav?: boolean;
          show_on_homepage?: boolean;
          slug: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          name_te?: string | null;
          parent_id?: string | null;
          position?: number;
          seo_description?: string | null;
          seo_title?: string | null;
          show_in_nav?: boolean;
          show_on_homepage?: boolean;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          article_id: string;
          body: string;
          created_at: string;
          flagged_reason: string | null;
          id: string;
          is_approved: boolean;
          is_flagged: boolean;
          moderated_at: string | null;
          moderated_by: string | null;
          parent_id: string | null;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          article_id: string;
          body: string;
          created_at?: string;
          flagged_reason?: string | null;
          id?: string;
          is_approved?: boolean;
          is_flagged?: boolean;
          moderated_at?: string | null;
          moderated_by?: string | null;
          parent_id?: string | null;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          article_id?: string;
          body?: string;
          created_at?: string;
          flagged_reason?: string | null;
          id?: string;
          is_approved?: boolean;
          is_flagged?: boolean;
          moderated_at?: string | null;
          moderated_by?: string | null;
          parent_id?: string | null;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      content_licenses: {
        Row: {
          allow_api: boolean;
          allow_full_text: boolean;
          allow_images: boolean;
          allow_republish: boolean;
          allowed_category_ids: string[];
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          period_end: string | null;
          period_start: string;
          quota_per_period: number | null;
          subscription_id: string | null;
          updated_at: string;
          used_this_period: number;
        };
        Insert: {
          allow_api?: boolean;
          allow_full_text?: boolean;
          allow_images?: boolean;
          allow_republish?: boolean;
          allowed_category_ids?: string[];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          period_end?: string | null;
          period_start?: string;
          quota_per_period?: number | null;
          subscription_id?: string | null;
          updated_at?: string;
          used_this_period?: number;
        };
        Update: {
          allow_api?: boolean;
          allow_full_text?: boolean;
          allow_images?: boolean;
          allow_republish?: boolean;
          allowed_category_ids?: string[];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          period_end?: string | null;
          period_start?: string;
          quota_per_period?: number | null;
          subscription_id?: string | null;
          updated_at?: string;
          used_this_period?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'content_licenses_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_licenses_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      editor_reviews: {
        Row: {
          action: Database['public']['Enums']['review_action'];
          anchor: Json | null;
          article_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          reviewer_id: string;
        };
        Insert: {
          action: Database['public']['Enums']['review_action'];
          anchor?: Json | null;
          article_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          reviewer_id: string;
        };
        Update: {
          action?: Database['public']['Enums']['review_action'];
          anchor?: Json | null;
          article_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'editor_reviews_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editor_reviews_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editor_reviews_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editor_reviews_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editor_reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'editor_reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      email_events: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['email_event_kind'];
          occurred_at: string;
          payload: Json;
          provider: string;
          provider_event_id: string | null;
          provider_message_id: string | null;
          recipient: string;
          subject: string | null;
          template: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['email_event_kind'];
          occurred_at?: string;
          payload?: Json;
          provider?: string;
          provider_event_id?: string | null;
          provider_message_id?: string | null;
          recipient: string;
          subject?: string | null;
          template?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['email_event_kind'];
          occurred_at?: string;
          payload?: Json;
          provider?: string;
          provider_event_id?: string | null;
          provider_message_id?: string | null;
          recipient?: string;
          subject?: string | null;
          template?: string | null;
        };
        Relationships: [];
      };
      entitlements: {
        Row: {
          expires_at: string | null;
          granted_at: string;
          id: string;
          kind: Database['public']['Enums']['entitlement_kind'];
          organization_id: string | null;
          profile_id: string | null;
          revoked_at: string | null;
          source: string;
          subscription_id: string | null;
        };
        Insert: {
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          kind: Database['public']['Enums']['entitlement_kind'];
          organization_id?: string | null;
          profile_id?: string | null;
          revoked_at?: string | null;
          source?: string;
          subscription_id?: string | null;
        };
        Update: {
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['entitlement_kind'];
          organization_id?: string | null;
          profile_id?: string | null;
          revoked_at?: string | null;
          source?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'entitlements_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entitlements_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entitlements_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'entitlements_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      followed_authors: {
        Row: {
          author_id: string;
          created_at: string;
          profile_id: string;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          profile_id: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'followed_authors_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'followed_authors_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'followed_authors_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'followed_authors_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      followed_categories: {
        Row: {
          category_id: string;
          created_at: string;
          profile_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          profile_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'followed_categories_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'followed_categories_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'followed_categories_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      homepage_sections: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          item_limit: number;
          key: string;
          layout: string;
          location_id: string | null;
          manual_article_ids: string[];
          position: number;
          source: string;
          tag_id: string | null;
          title: string;
          title_te: string | null;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          item_limit?: number;
          key: string;
          layout?: string;
          location_id?: string | null;
          manual_article_ids?: string[];
          position?: number;
          source?: string;
          tag_id?: string | null;
          title: string;
          title_te?: string | null;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          item_limit?: number;
          key?: string;
          layout?: string;
          location_id?: string | null;
          manual_article_ids?: string[];
          position?: number;
          source?: string;
          tag_id?: string | null;
          title?: string;
          title_te?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'homepage_sections_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'homepage_sections_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'homepage_sections_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          amount_paise: number;
          billing_snapshot: Json;
          created_at: string;
          currency: string;
          id: string;
          issued_at: string;
          number: string;
          organization_id: string | null;
          payment_id: string | null;
          pdf_url: string | null;
          period_end: string | null;
          period_start: string | null;
          profile_id: string | null;
          subscription_id: string | null;
          tax_paise: number;
        };
        Insert: {
          amount_paise: number;
          billing_snapshot?: Json;
          created_at?: string;
          currency?: string;
          id?: string;
          issued_at?: string;
          number: string;
          organization_id?: string | null;
          payment_id?: string | null;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          profile_id?: string | null;
          subscription_id?: string | null;
          tax_paise?: number;
        };
        Update: {
          amount_paise?: number;
          billing_snapshot?: Json;
          created_at?: string;
          currency?: string;
          id?: string;
          issued_at?: string;
          number?: string;
          organization_id?: string | null;
          payment_id?: string | null;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          profile_id?: string | null;
          subscription_id?: string | null;
          tax_paise?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      license_usage: {
        Row: {
          accessed_at: string;
          action: string;
          article_id: string;
          id: number;
          ip_hash: string | null;
          license_id: string;
          organization_id: string;
          profile_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          accessed_at?: string;
          action?: string;
          article_id: string;
          id?: number;
          ip_hash?: string | null;
          license_id: string;
          organization_id: string;
          profile_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          accessed_at?: string;
          action?: string;
          article_id?: string;
          id?: number;
          ip_hash?: string | null;
          license_id?: string;
          organization_id?: string;
          profile_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'license_usage_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'license_usage_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'license_usage_license_id_fkey';
            columns: ['license_id'];
            isOneToOne: false;
            referencedRelation: 'content_licenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'license_usage_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'license_usage_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'license_usage_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          name_te: string | null;
          parent_id: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          name_te?: string | null;
          parent_id?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          name_te?: string | null;
          parent_id?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      media: {
        Row: {
          alt_text: string | null;
          alt_text_te: string | null;
          blur_data_url: string | null;
          bucket: string;
          caption: string | null;
          caption_te: string | null;
          captured_at: string | null;
          checksum: string | null;
          copyright: string | null;
          created_at: string;
          credit: string | null;
          dominant_color: string | null;
          driver: string;
          duration_seconds: number | null;
          height: number | null;
          id: string;
          is_archived: boolean;
          is_public: boolean;
          kind: Database['public']['Enums']['media_kind'];
          mime_type: string;
          photographer_id: string | null;
          size_bytes: number;
          source: string | null;
          storage_key: string;
          title: string | null;
          updated_at: string;
          uploaded_by: string | null;
          usage_count: number;
          variants: Json;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          alt_text_te?: string | null;
          blur_data_url?: string | null;
          bucket?: string;
          caption?: string | null;
          caption_te?: string | null;
          captured_at?: string | null;
          checksum?: string | null;
          copyright?: string | null;
          created_at?: string;
          credit?: string | null;
          dominant_color?: string | null;
          driver?: string;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string;
          is_archived?: boolean;
          is_public?: boolean;
          kind?: Database['public']['Enums']['media_kind'];
          mime_type: string;
          photographer_id?: string | null;
          size_bytes: number;
          source?: string | null;
          storage_key: string;
          title?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          usage_count?: number;
          variants?: Json;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          alt_text_te?: string | null;
          blur_data_url?: string | null;
          bucket?: string;
          caption?: string | null;
          caption_te?: string | null;
          captured_at?: string | null;
          checksum?: string | null;
          copyright?: string | null;
          created_at?: string;
          credit?: string | null;
          dominant_color?: string | null;
          driver?: string;
          duration_seconds?: number | null;
          height?: number | null;
          id?: string;
          is_archived?: boolean;
          is_public?: boolean;
          kind?: Database['public']['Enums']['media_kind'];
          mime_type?: string;
          photographer_id?: string | null;
          size_bytes?: number;
          source?: string | null;
          storage_key?: string;
          title?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          usage_count?: number;
          variants?: Json;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_photographer_id_fkey';
            columns: ['photographer_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_photographer_id_fkey';
            columns: ['photographer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      newsletter_campaigns: {
        Row: {
          article_ids: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database['public']['Enums']['newsletter_kind'];
          preheader: string | null;
          provider_broadcast_id: string | null;
          recipient_count: number;
          scheduled_for: string | null;
          sent_at: string | null;
          subject: string;
        };
        Insert: {
          article_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database['public']['Enums']['newsletter_kind'];
          preheader?: string | null;
          provider_broadcast_id?: string | null;
          recipient_count?: number;
          scheduled_for?: string | null;
          sent_at?: string | null;
          subject: string;
        };
        Update: {
          article_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['newsletter_kind'];
          preheader?: string | null;
          provider_broadcast_id?: string | null;
          recipient_count?: number;
          scheduled_for?: string | null;
          sent_at?: string | null;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'newsletter_campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          category_ids: string[];
          confirmation_token: string | null;
          confirmed_at: string | null;
          created_at: string;
          email: string;
          id: string;
          is_confirmed: boolean;
          kinds: Database['public']['Enums']['newsletter_kind'][];
          language: Database['public']['Enums']['content_language'];
          profile_id: string | null;
          source: string | null;
          unsubscribe_token: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          category_ids?: string[];
          confirmation_token?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          is_confirmed?: boolean;
          kinds?: Database['public']['Enums']['newsletter_kind'][];
          language?: Database['public']['Enums']['content_language'];
          profile_id?: string | null;
          source?: string | null;
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          category_ids?: string[];
          confirmation_token?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          is_confirmed?: boolean;
          kinds?: Database['public']['Enums']['newsletter_kind'][];
          language?: Database['public']['Enums']['content_language'];
          profile_id?: string | null;
          source?: string | null;
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'newsletter_subscribers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'newsletter_subscribers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          metadata: Json;
          profile_id: string;
          read_at: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          metadata?: Json;
          profile_id: string;
          read_at?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          metadata?: Json;
          profile_id?: string;
          read_at?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          is_owner: boolean;
          organization_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          is_owner?: boolean;
          organization_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          is_owner?: boolean;
          organization_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          billing_address: Json;
          billing_email: string;
          contact_phone: string | null;
          created_at: string;
          gstin: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          billing_email: string;
          contact_phone?: string | null;
          created_at?: string;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          billing_email?: string;
          contact_phone?: string | null;
          created_at?: string;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          event_type: string;
          id: string;
          payload: Json;
          process_error: string | null;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          received_at: string;
          signature_verified: boolean;
        };
        Insert: {
          event_type: string;
          id?: string;
          payload: Json;
          process_error?: string | null;
          processed_at?: string | null;
          provider?: string;
          provider_event_id: string;
          received_at?: string;
          signature_verified?: boolean;
        };
        Update: {
          event_type?: string;
          id?: string;
          payload?: Json;
          process_error?: string | null;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string;
          received_at?: string;
          signature_verified?: boolean;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_paise: number;
          amount_refunded_paise: number;
          created_at: string;
          currency: string;
          description: string | null;
          failure_reason: string | null;
          id: string;
          method: string | null;
          organization_id: string | null;
          paid_at: string | null;
          profile_id: string | null;
          provider: string;
          provider_order_id: string | null;
          provider_payment_id: string | null;
          provider_signature: string | null;
          status: Database['public']['Enums']['payment_status'];
          subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_paise: number;
          amount_refunded_paise?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          failure_reason?: string | null;
          id?: string;
          method?: string | null;
          organization_id?: string | null;
          paid_at?: string | null;
          profile_id?: string | null;
          provider?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_paise?: number;
          amount_refunded_paise?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          failure_reason?: string | null;
          id?: string;
          method?: string | null;
          organization_id?: string | null;
          paid_at?: string | null;
          profile_id?: string | null;
          provider?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          provider_signature?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_media_id: string | null;
          bio: string | null;
          bio_te: string | null;
          can_manage_media_library: boolean;
          can_publish: boolean;
          can_send_push: boolean;
          created_at: string;
          designation: string | null;
          display_name: string | null;
          display_name_te: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_seen_at: string | null;
          phone: string | null;
          preferred_language: Database['public']['Enums']['content_language'];
          role: Database['public']['Enums']['user_role'];
          slug: string | null;
          social_links: Json;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_media_id?: string | null;
          bio?: string | null;
          bio_te?: string | null;
          can_manage_media_library?: boolean;
          can_publish?: boolean;
          can_send_push?: boolean;
          created_at?: string;
          designation?: string | null;
          display_name?: string | null;
          display_name_te?: string | null;
          email: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          preferred_language?: Database['public']['Enums']['content_language'];
          role?: Database['public']['Enums']['user_role'];
          slug?: string | null;
          social_links?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_media_id?: string | null;
          bio?: string | null;
          bio_te?: string | null;
          can_manage_media_library?: boolean;
          can_publish?: boolean;
          can_send_push?: boolean;
          created_at?: string;
          designation?: string | null;
          display_name?: string | null;
          display_name_te?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          phone?: string | null;
          preferred_language?: Database['public']['Enums']['content_language'];
          role?: Database['public']['Enums']['user_role'];
          slug?: string | null;
          social_links?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_avatar_media_fk';
            columns: ['avatar_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      push_notifications: {
        Row: {
          article_id: string | null;
          content: string;
          created_at: string;
          error: string | null;
          heading: string;
          id: string;
          image_url: string | null;
          provider_notification_id: string | null;
          recipient_count: number | null;
          sent_at: string | null;
          sent_by: string | null;
          topic: Database['public']['Enums']['push_topic'];
          url: string | null;
        };
        Insert: {
          article_id?: string | null;
          content: string;
          created_at?: string;
          error?: string | null;
          heading: string;
          id?: string;
          image_url?: string | null;
          provider_notification_id?: string | null;
          recipient_count?: number | null;
          sent_at?: string | null;
          sent_by?: string | null;
          topic?: Database['public']['Enums']['push_topic'];
          url?: string | null;
        };
        Update: {
          article_id?: string | null;
          content?: string;
          created_at?: string;
          error?: string | null;
          heading?: string;
          id?: string;
          image_url?: string | null;
          provider_notification_id?: string | null;
          recipient_count?: number | null;
          sent_at?: string | null;
          sent_by?: string | null;
          topic?: Database['public']['Enums']['push_topic'];
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_notifications_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_notifications_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_notifications_sent_by_fkey';
            columns: ['sent_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_notifications_sent_by_fkey';
            columns: ['sent_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscribers: {
        Row: {
          created_at: string;
          device_kind: string | null;
          id: string;
          is_active: boolean;
          language: Database['public']['Enums']['content_language'];
          profile_id: string | null;
          provider: string;
          provider_player_id: string;
          topics: Database['public']['Enums']['push_topic'][];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          device_kind?: string | null;
          id?: string;
          is_active?: boolean;
          language?: Database['public']['Enums']['content_language'];
          profile_id?: string | null;
          provider?: string;
          provider_player_id: string;
          topics?: Database['public']['Enums']['push_topic'][];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          device_kind?: string | null;
          id?: string;
          is_active?: boolean;
          language?: Database['public']['Enums']['content_language'];
          profile_id?: string | null;
          provider?: string;
          provider_player_id?: string;
          topics?: Database['public']['Enums']['push_topic'][];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscribers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_subscribers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_articles: {
        Row: {
          article_id: string;
          created_at: string;
          profile_id: string;
        };
        Insert: {
          article_id: string;
          created_at?: string;
          profile_id: string;
        };
        Update: {
          article_id?: string;
          created_at?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_articles_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_articles_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_articles_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_articles_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings: {
        Row: {
          ads_txt: string | null;
          announcement: string | null;
          breaking_ticker_enabled: boolean;
          breaking_ticker_ttl_minutes: number;
          comments_enabled: boolean;
          contact_email: string | null;
          contact_phone: string | null;
          default_og_media_id: string | null;
          id: boolean;
          logo_media_id: string | null;
          newsletter_enabled: boolean;
          office_address: string | null;
          paywall_enabled: boolean;
          push_enabled: boolean;
          robots_extra: string | null;
          site_name: string;
          social_links: Json;
          tagline: string | null;
          tagline_te: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          ads_txt?: string | null;
          announcement?: string | null;
          breaking_ticker_enabled?: boolean;
          breaking_ticker_ttl_minutes?: number;
          comments_enabled?: boolean;
          contact_email?: string | null;
          contact_phone?: string | null;
          default_og_media_id?: string | null;
          id?: boolean;
          logo_media_id?: string | null;
          newsletter_enabled?: boolean;
          office_address?: string | null;
          paywall_enabled?: boolean;
          push_enabled?: boolean;
          robots_extra?: string | null;
          site_name?: string;
          social_links?: Json;
          tagline?: string | null;
          tagline_te?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ads_txt?: string | null;
          announcement?: string | null;
          breaking_ticker_enabled?: boolean;
          breaking_ticker_ttl_minutes?: number;
          comments_enabled?: boolean;
          contact_email?: string | null;
          contact_phone?: string | null;
          default_og_media_id?: string | null;
          id?: boolean;
          logo_media_id?: string | null;
          newsletter_enabled?: boolean;
          office_address?: string | null;
          paywall_enabled?: boolean;
          push_enabled?: boolean;
          robots_extra?: string | null;
          site_name?: string;
          social_links?: Json;
          tagline?: string | null;
          tagline_te?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'site_settings_default_og_media_id_fkey';
            columns: ['default_og_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_settings_logo_media_id_fkey';
            columns: ['logo_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      subscription_plans: {
        Row: {
          amount_paise: number;
          audience: Database['public']['Enums']['plan_audience'];
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          entitlements: Database['public']['Enums']['entitlement_kind'][];
          id: string;
          interval: Database['public']['Enums']['plan_interval'];
          is_active: boolean;
          is_public: boolean;
          license_quota: number | null;
          name: string;
          name_te: string | null;
          position: number;
          provider: string;
          provider_plan_id: string | null;
          trial_days: number;
          updated_at: string;
        };
        Insert: {
          amount_paise: number;
          audience?: Database['public']['Enums']['plan_audience'];
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          entitlements?: Database['public']['Enums']['entitlement_kind'][];
          id?: string;
          interval?: Database['public']['Enums']['plan_interval'];
          is_active?: boolean;
          is_public?: boolean;
          license_quota?: number | null;
          name: string;
          name_te?: string | null;
          position?: number;
          provider?: string;
          provider_plan_id?: string | null;
          trial_days?: number;
          updated_at?: string;
        };
        Update: {
          amount_paise?: number;
          audience?: Database['public']['Enums']['plan_audience'];
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          entitlements?: Database['public']['Enums']['entitlement_kind'][];
          id?: string;
          interval?: Database['public']['Enums']['plan_interval'];
          is_active?: boolean;
          is_public?: boolean;
          license_quota?: number | null;
          name?: string;
          name_te?: string | null;
          position?: number;
          provider?: string;
          provider_plan_id?: string | null;
          trial_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          ended_at: string | null;
          id: string;
          metadata: Json;
          organization_id: string | null;
          plan_id: string;
          profile_id: string | null;
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
          plan_id: string;
          profile_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
          plan_id?: string;
          profile_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'subscription_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_featured: boolean;
          name: string;
          name_te: string | null;
          slug: string;
          updated_at: string;
          usage_count: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          name: string;
          name_te?: string | null;
          slug: string;
          updated_at?: string;
          usage_count?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          name?: string;
          name_te?: string | null;
          slug?: string;
          updated_at?: string;
          usage_count?: number;
        };
        Relationships: [];
      };
      upload_tickets: {
        Row: {
          bucket: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          kind: Database['public']['Enums']['media_kind'];
          max_size_bytes: number;
          mime_type: string;
          requested_by: string;
          storage_key: string;
        };
        Insert: {
          bucket: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          kind?: Database['public']['Enums']['media_kind'];
          max_size_bytes: number;
          mime_type: string;
          requested_by: string;
          storage_key: string;
        };
        Update: {
          bucket?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['media_kind'];
          max_size_bytes?: number;
          mime_type?: string;
          requested_by?: string;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'upload_tickets_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'upload_tickets_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      article_previews: {
        Row: {
          author_id: string | null;
          author_name: string | null;
          author_name_te: string | null;
          author_slug: string | null;
          byline_override: string | null;
          canonical_url: string | null;
          category_id: string | null;
          category_name: string | null;
          category_name_te: string | null;
          category_slug: string | null;
          comment_count: number | null;
          excerpt: string | null;
          featured_image_alt: string | null;
          featured_image_alt_te: string | null;
          featured_image_blur: string | null;
          featured_image_caption: string | null;
          featured_image_credit: string | null;
          featured_image_height: number | null;
          featured_image_id: string | null;
          featured_image_key: string | null;
          featured_image_variants: Json | null;
          featured_image_width: number | null;
          first_published_at: string | null;
          id: string | null;
          is_breaking: boolean | null;
          is_exclusive: boolean | null;
          is_featured: boolean | null;
          is_premium: boolean | null;
          is_sponsored: boolean | null;
          language: Database['public']['Enums']['content_language'] | null;
          location_id: string | null;
          location_name: string | null;
          location_name_te: string | null;
          location_slug: string | null;
          noindex: boolean | null;
          priority: number | null;
          published_at: string | null;
          reading_time_minutes: number | null;
          secondary_category_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          share_count: number | null;
          slug: string | null;
          subtitle: string | null;
          title: string | null;
          title_te: string | null;
          updated_at: string | null;
          view_count: number | null;
          word_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'articles_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'author_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_featured_image_id_fkey';
            columns: ['featured_image_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'articles_secondary_category_id_fkey';
            columns: ['secondary_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      author_profiles: {
        Row: {
          article_count: number | null;
          avatar_key: string | null;
          bio: string | null;
          bio_te: string | null;
          designation: string | null;
          id: string | null;
          name: string | null;
          name_te: string | null;
          role: Database['public']['Enums']['user_role'] | null;
          slug: string | null;
          social_links: Json | null;
        };
        Relationships: [];
      };
      trending_articles: {
        Row: {
          article_id: string | null;
          last_viewed_at: string | null;
          views_1h: number | null;
          views_24h: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'article_views_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'article_previews';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'article_views_article_id_fkey';
            columns: ['article_id'];
            isOneToOne: false;
            referencedRelation: 'articles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      can_edit_article: { Args: { p_article: string }; Returns: boolean };
      can_publish: { Args: never; Returns: boolean };
      can_read_article: { Args: { p_article: string }; Returns: boolean };
      consume_license: {
        Args: { p_action?: string; p_article_id: string; p_license_id: string };
        Returns: boolean;
      };
      current_role_name: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      extract_doc_text: { Args: { doc: Json }; Returns: string };
      has_entitlement: {
        Args: { p_kind: Database['public']['Enums']['entitlement_kind'] };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_editorial: { Args: never; Returns: boolean };
      is_legal_transition: {
        Args: {
          p_from: Database['public']['Enums']['article_status'];
          p_to: Database['public']['Enums']['article_status'];
        };
        Returns: boolean;
      };
      is_newsroom: { Args: never; Returns: boolean };
      is_org_member: { Args: { p_org: string }; Returns: boolean };
      manages_subscriptions: { Args: never; Returns: boolean };
      publish_article: {
        Args: { p_article_id: string; p_scheduled_for?: string };
        Returns: Database['public']['Enums']['article_status'];
      };
      publish_due_articles: {
        Args: never;
        Returns: {
          category_slug: string;
          id: string;
          slug: string;
        }[];
      };
      record_article_view: {
        Args: {
          p_article_id: string;
          p_device_kind?: string;
          p_read_depth?: number;
          p_referrer_host?: string;
          p_visitor_hash?: string;
        };
        Returns: undefined;
      };
      refresh_article_stats: { Args: { p_since?: string }; Returns: number };
      refresh_trending: { Args: never; Returns: undefined };
      review_article: {
        Args: {
          p_action: Database['public']['Enums']['review_action'];
          p_article_id: string;
          p_comment?: string;
        };
        Returns: Database['public']['Enums']['article_status'];
      };
      role_rank: {
        Args: { r: Database['public']['Enums']['user_role'] };
        Returns: number;
      };
      search_articles: {
        Args: {
          p_category_slug?: string;
          p_limit?: number;
          p_offset?: number;
          p_query: string;
        };
        Returns: {
          author_name: string;
          category_name: string;
          category_slug: string;
          excerpt: string;
          featured_image_alt: string;
          featured_image_key: string;
          id: string;
          is_premium: boolean;
          published_at: string;
          rank: number;
          reading_time_minutes: number;
          slug: string;
          title: string;
          title_te: string;
          total_count: number;
        }[];
      };
      slugify: { Args: { input: string }; Returns: string };
      submit_article: {
        Args: { p_article_id: string; p_note?: string };
        Returns: Database['public']['Enums']['article_status'];
      };
      subscribe_to_newsletter: {
        Args: {
          p_email: string;
          p_kinds?: Database['public']['Enums']['newsletter_kind'][];
          p_language?: Database['public']['Enums']['content_language'];
          p_source?: string;
        };
        Returns: string;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_metadata?: Json;
          p_resource_id?: string;
          p_resource_type: string;
        };
        Returns: number;
      };
    };
    Enums: {
      article_status:
        | 'draft'
        | 'submitted'
        | 'in_review'
        | 'changes_requested'
        | 'approved'
        | 'scheduled'
        | 'published'
        | 'archived';
      content_language: 'te' | 'en';
      email_event_kind:
        | 'queued'
        | 'sent'
        | 'delivered'
        | 'delivery_delayed'
        | 'opened'
        | 'clicked'
        | 'bounced'
        | 'complained'
        | 'failed';
      entitlement_kind:
        'premium_content' | 'ad_light' | 'newsletter_premium' | 'content_license' | 'api_access';
      media_kind: 'image' | 'document' | 'audio' | 'avatar';
      newsletter_kind:
        | 'daily_digest'
        | 'morning_briefing'
        | 'evening_briefing'
        | 'breaking_news'
        | 'category_digest'
        | 'weekly_roundup';
      payment_status:
        'created' | 'authorized' | 'captured' | 'refunded' | 'partially_refunded' | 'failed';
      plan_audience: 'reader' | 'business';
      plan_interval: 'one_time' | 'monthly' | 'quarterly' | 'annual';
      push_topic:
        | 'breaking_news'
        | 'politics'
        | 'sports'
        | 'cinema'
        | 'business'
        | 'technology'
        | 'andhra_pradesh'
        | 'telangana'
        | 'national'
        | 'international';
      review_action:
        | 'submitted'
        | 'claimed'
        | 'approved'
        | 'changes_requested'
        | 'rejected'
        | 'published'
        | 'scheduled'
        | 'unpublished'
        | 'archived'
        | 'restored';
      subscription_status:
        'incomplete' | 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired';
      user_role:
        | 'super_admin'
        | 'managing_editor'
        | 'editor'
        | 'reporter'
        | 'photographer'
        | 'subscription_manager'
        | 'business_customer'
        | 'reader';
      video_provider: 'youtube';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      article_status: [
        'draft',
        'submitted',
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'archived',
      ],
      content_language: ['te', 'en'],
      email_event_kind: [
        'queued',
        'sent',
        'delivered',
        'delivery_delayed',
        'opened',
        'clicked',
        'bounced',
        'complained',
        'failed',
      ],
      entitlement_kind: [
        'premium_content',
        'ad_light',
        'newsletter_premium',
        'content_license',
        'api_access',
      ],
      media_kind: ['image', 'document', 'audio', 'avatar'],
      newsletter_kind: [
        'daily_digest',
        'morning_briefing',
        'evening_briefing',
        'breaking_news',
        'category_digest',
        'weekly_roundup',
      ],
      payment_status: [
        'created',
        'authorized',
        'captured',
        'refunded',
        'partially_refunded',
        'failed',
      ],
      plan_audience: ['reader', 'business'],
      plan_interval: ['one_time', 'monthly', 'quarterly', 'annual'],
      push_topic: [
        'breaking_news',
        'politics',
        'sports',
        'cinema',
        'business',
        'technology',
        'andhra_pradesh',
        'telangana',
        'national',
        'international',
      ],
      review_action: [
        'submitted',
        'claimed',
        'approved',
        'changes_requested',
        'rejected',
        'published',
        'scheduled',
        'unpublished',
        'archived',
        'restored',
      ],
      subscription_status: [
        'incomplete',
        'trialing',
        'active',
        'past_due',
        'paused',
        'cancelled',
        'expired',
      ],
      user_role: [
        'super_admin',
        'managing_editor',
        'editor',
        'reporter',
        'photographer',
        'subscription_manager',
        'business_customer',
        'reader',
      ],
      video_provider: ['youtube'],
    },
  },
} as const;

// =============================================================================
// Convenience aliases
// =============================================================================
// Everything above this line is generated by `npm run db:types` and must not be
// edited by hand. This block is appended by the same script (see
// scripts/append-type-aliases.mjs) and gives the workspace short, stable names
// for the shapes it uses most, so a regeneration never churns imports across
// the codebase.

// Tables / TablesInsert / TablesUpdate / Enums are emitted by the generator
// itself; only Views is missing, so that is the one we add.
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];

// --- Enums -------------------------------------------------------------------
export type UserRole = Enums<'user_role'>;
export type ArticleStatus = Enums<'article_status'>;
export type ReviewAction = Enums<'review_action'>;
export type MediaKind = Enums<'media_kind'>;
export type VideoProvider = Enums<'video_provider'>;
export type ContentLanguage = Enums<'content_language'>;
export type SubscriptionStatus = Enums<'subscription_status'>;
export type PlanInterval = Enums<'plan_interval'>;
export type PlanAudience = Enums<'plan_audience'>;
export type PaymentStatus = Enums<'payment_status'>;
export type EntitlementKind = Enums<'entitlement_kind'>;
export type NewsletterKind = Enums<'newsletter_kind'>;
export type EmailEventKind = Enums<'email_event_kind'>;
export type PushTopic = Enums<'push_topic'>;

// --- Table rows --------------------------------------------------------------
export type ProfileRow = Tables<'profiles'>;
export type OrganizationRow = Tables<'organizations'>;
export type CategoryRow = Tables<'categories'>;
export type LocationRow = Tables<'locations'>;
export type TagRow = Tables<'tags'>;
export type MediaRow = Tables<'media'>;
export type UploadTicketRow = Tables<'upload_tickets'>;
export type ArticleRow = Tables<'articles'>;
export type ArticleMediaRow = Tables<'article_media'>;
export type ArticleVideoRow = Tables<'article_videos'>;
export type ArticleRevisionRow = Tables<'article_revisions'>;
export type ArticleStatusHistoryRow = Tables<'article_status_history'>;
export type EditorReviewRow = Tables<'editor_reviews'>;
export type ArticleAssignmentRow = Tables<'article_assignments'>;
export type CommentRow = Tables<'comments'>;
export type SubscriptionPlanRow = Tables<'subscription_plans'>;
export type SubscriptionRow = Tables<'subscriptions'>;
export type PaymentRow = Tables<'payments'>;
export type EntitlementRow = Tables<'entitlements'>;
export type ContentLicenseRow = Tables<'content_licenses'>;
export type NewsletterSubscriberRow = Tables<'newsletter_subscribers'>;
export type PushSubscriberRow = Tables<'push_subscribers'>;
export type AuditLogRow = Tables<'audit_logs'>;
export type SiteSettingsRow = Tables<'site_settings'>;
export type HomepageSectionRow = Tables<'homepage_sections'>;
export type NotificationRow = Tables<'notifications'>;

// --- View rows ---------------------------------------------------------------
export type ArticlePreviewRow = Views<'article_previews'>;
export type AuthorProfileRow = Views<'author_profiles'>;
export type TrendingArticleRow = Views<'trending_articles'>;
